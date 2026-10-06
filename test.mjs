import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import plugin from './index.mjs';

const secret = 'sk-bayleaf-synthetic-never-print';
const context = { sessionID: 'ses_fixture', agent: 'build', messageID: 'msg_fixture', id: 'call_fixture',
  signal: new AbortController().signal };

function fixture(effect = 'allow', decision = 'once') {
  const tools = new Map(), skills = new Map(), providers = new Map();
  const calls = []; let deliver;
  const ctx = { app: { version: '2.0.23' }, location: { directory: '/workspace' },
    skill: { transform: async fn => fn({ add: s => skills.set(s.id, s) }) },
    websearch: { transform: async fn => fn({ add: p => providers.set(p.id, p), default: { set() {} } }) },
    tool: { transform: async fn => fn({ add: t => tools.set(t.name, t) }) },
    permission: { reply: async () => {} },
    event: { subscribe: ({ signal }) => {
      const pending = new Promise(resolve => {
        deliver = resolve;
        signal.addEventListener('abort', () => resolve(null), { once: true });
      });
      return (async function* () { const event = await pending; if (event) yield event; })();
    } },
  };
  const fetcher = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).startsWith('http://127.0.0.1:45678/')) {
      assert.equal(options.headers.Authorization,
        'Basic '+Buffer.from('opencode:synthetic-password').toString('base64'));
      if (effect === 'ask') deliver({ type: 'permission.replied', data: {
        sessionID: context.sessionID, requestID: 'per_fixture', reply: decision } });
      return Response.json({ data: { id: 'per_fixture', effect } });
    }
    assert.equal(options.headers.Authorization, 'Bearer '+secret);
    assert.equal(options.redirect, 'error');
    if (String(url).endsWith('/search')) return Response.json({ results: [
      { title: 'Source', url: 'https://example.test', snippet: 'Evidence' } ] });
    return Response.json({ results: [{ url: 'https://example.test', content: '# Extracted page' }] });
  };
  return { ctx, tools, skills, providers, calls, fetcher };
}

async function run(fn) {
  const oldFetch = globalThis.fetch;
  const oldEnv = { ...process.env };
  process.env.BAYLEAF_API_KEY = secret;
  process.env.BAYLEAF_OPENCODE_URL = 'http://127.0.0.1:45678';
  process.env.OPENCODE_PASSWORD = 'synthetic-password';
  try { await fn(); } finally {
    globalThis.fetch = oldFetch;
    for (const name of ['BAYLEAF_API_KEY', 'BAYLEAF_OPENCODE_URL', 'OPENCODE_PASSWORD']) {
      if (oldEnv[name] === undefined) delete process.env[name]; else process.env[name] = oldEnv[name];
    }
  }
}

test('package registers familiar tools and canonical skills with real helper paths', () => run(async () => {
  const f = fixture(); await plugin.setup(f.ctx);
  assert.deepEqual([...f.tools.keys()], ['webfetch']);
  assert.deepEqual([...f.skills.keys()].sort(), ['bayleaf-sandbox-technique', 'expose-sandbox-ports-technique']);
  for (const skill of f.skills.values()) {
    assert.ok(skill.content.startsWith('\n#') || skill.content.startsWith('#'));
    assert.ok(!skill.content.startsWith('---'));
    assert.ok((await readFile(skill.path, 'utf8')).includes(skill.description));
    const helper = skill.id === 'bayleaf-sandbox-technique' ? 'status.py' : 'expose.py';
    assert.ok((await readFile(new URL('./scripts/'+helper, 'file://'+skill.path), 'utf8')).includes('BAYLEAF_API_KEY'));
  }
}));

test('search adapts results without exposing credentials', () => run(async () => {
  const f = fixture(); globalThis.fetch = f.fetcher; await plugin.setup(f.ctx);
  const results = await f.providers.get('bayleaf').execute({ query: 'test' }, context);
  assert.deepEqual(results, [{ title:'Source', url:'https://example.test', content:'Evidence', time:{} }]);
  assert.ok(!JSON.stringify(results).includes(secret));
}));

for (const effect of ['allow', 'deny', 'ask']) {
  test('fetch uses URL-resource permission: '+effect, () => run(async () => {
    const f = fixture(effect); globalThis.fetch = f.fetcher; await plugin.setup(f.ctx);
    const fetchPage = () => f.tools.get('webfetch').execute({ url:'https://example.test' }, context);
    if (effect === 'deny') await assert.rejects(fetchPage, /denied/);
    else assert.deepEqual(await fetchPage(), { content:'# Extracted page' });
    assert.equal(f.calls.filter(c => c.url.startsWith('https://')).length, effect === 'deny' ? 0 : 1);
    assert.deepEqual(JSON.parse(f.calls[0].options.body).resources, ['https://example.test']);
    assert.equal(new URL(f.calls[0].url).searchParams.get('location[directory]'), '/workspace');
  }));
}

test('rejected UI approval never reaches BayLeaf', () => run(async () => {
  const f = fixture('ask','reject'); globalThis.fetch = f.fetcher; await plugin.setup(f.ctx);
  await assert.rejects(() => f.tools.get('webfetch').execute({url:'https://example.test'},context), /denied/);
  assert.equal(f.calls.length,1);
}));

test('upstream failures and malformed/empty extraction are explicit and sanitized', () => run(async () => {
  const f = fixture(); await plugin.setup(f.ctx);
  for (const response of [new Response(secret,{status:403}),
    Response.json({results:[],failed_results:[{url:'https://example.test',error:secret}]}),
    Response.json({results:[{content:''}]})]) {
    globalThis.fetch = (url, options) => String(url).startsWith('http:') ? f.fetcher(url, options) : response;
    await assert.rejects(() => f.tools.get('webfetch').execute({url:'https://example.test'},context),
      error => !error.message.includes(secret) && /HTTP 403|could not extract/.test(error.message));
  }
}));

test('transport exceptions are not copied into model-visible errors', () => run(async () => {
  const f = fixture(); await plugin.setup(f.ctx);
  globalThis.fetch = async () => { throw new Error(secret); };
  await assert.rejects(() => f.providers.get('bayleaf').execute({query:'test'},context),
    error => error.message === 'BayLeaf web request unavailable or timed out');
}));

test('owner keys only, cancellation, and bounded responses', () => run(async () => {
  const f = fixture(); await plugin.setup(f.ctx);
  process.env.BAYLEAF_API_KEY = 'sk-bayleaf-grant-synthetic';
  await assert.rejects(() => f.providers.get('bayleaf').execute({query:'test'},context), /owner credential/);
  process.env.BAYLEAF_API_KEY = secret;
  const cancelled = new AbortController(); cancelled.abort();
  globalThis.fetch = async () => { throw new Error('abort'); };
  await assert.rejects(() => f.providers.get('bayleaf').execute({query:'test'},{signal:cancelled.signal}), /cancelled/);
  globalThis.fetch = async () => new Response('x'.repeat(2*1024*1024+1));
  await assert.rejects(() => f.providers.get('bayleaf').execute({query:'test'},context), /too large/);
}));

test('V1 and credential-bearing target URLs are rejected', () => run(async () => {
  const f = fixture(); await plugin.setup(f.ctx);
  await assert.rejects(() => plugin.setup({...f.ctx,app:{version:'1.9'}}), /V2/);
  await assert.rejects(() => f.tools.get('webfetch').execute({url:'https://user:pass@example.test'},context), /without credentials/);
}));
