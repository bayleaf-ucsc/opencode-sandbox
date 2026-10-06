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
  assert.deepEqual([...f.tools.keys()].sort(), ['bayleaf_expose','bayleaf_unexpose','bayleaf_usage','webfetch']);
  assert.deepEqual([...f.skills.keys()].sort(), ['bayleaf-sandboxes', 'bayleaf-scheduling']);
  for (const skill of f.skills.values()) {
    assert.equal(skill.name, skill.id);
    assert.match(skill.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(skill.description.length <= 1024);
    assert.ok(skill.content.startsWith('\n#') || skill.content.startsWith('#'));
    assert.ok(!skill.content.startsWith('---'));
    assert.ok((await readFile(skill.path, 'utf8')).includes(skill.description));
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

test('usage only reads its fixed route and omits unexpected fields', () => run(async () => {
  const f=fixture();await plugin.setup(f.ctx);const calls=[];
  globalThis.fetch=async(url,options)=>{
    calls.push({url,options});
    return Response.json({observed_at:'now',budgets:{standard:null},state:'started',phase:'ready',debug:secret});
  };
  const usage=JSON.parse((await f.tools.get('bayleaf_usage').execute({},context)).content);
  assert.deepEqual(usage,{observed_at:'now',budgets:{standard:null}});
  assert.deepEqual(calls.map(c=>new URL(c.url).pathname),['/usage']);
  assert.ok(calls.every(c=>c.options.method==='GET'&&c.options.body===undefined));
  globalThis.fetch=async()=>Response.json({budgets:{nested:secret}});
  await assert.rejects(()=>f.tools.get('bayleaf_usage').execute({},context),/Unexpected/);
}));

test('exposure permissions distinguish access scope; output strips provider data; revoke uses DELETE', () => run(async () => {
  const f=fixture();await plugin.setup(f.ctx);const calls=[];
  globalThis.fetch=async(url,options)=>{
    if(String(url).startsWith('http:'))return f.fetcher(url,options);
    calls.push({url,options});
    return options.method==='DELETE'?new Response(null,{status:204}):Response.json({
      url:'https://owner-private-test.bayleaf-proxies.dev/',expires_at:'2026-10-07T00:00:00Z',debug:secret});
  };
  for(const access of [undefined,'public']) {
    const output=JSON.parse((await f.tools.get('bayleaf_expose').execute({port:8000,access},context)).content);
    assert.equal(output.access,access??'private');assert.equal(output.debug,undefined);
  }
  assert.deepEqual(f.calls.map(c=>JSON.parse(c.options.body).resources),[['private:8000'],['public:8000']]);
  await f.tools.get('bayleaf_unexpose').execute({port:8000},context);
  assert.equal(calls.at(-1).options.method,'DELETE');
  assert.equal(new URL(calls.at(-1).url).pathname,'/sandbox/expose/8000');
  const before=f.calls.length;
  await assert.rejects(()=>f.tools.get('bayleaf_expose').execute({port:3100},context),/reserved/);
  assert.equal(f.calls.length,before);
}));

test('denied exposure never changes server state; malformed URLs never reach output', () => run(async () => {
  const denied=fixture('deny');globalThis.fetch=denied.fetcher;await plugin.setup(denied.ctx);
  await assert.rejects(()=>denied.tools.get('bayleaf_expose').execute({port:8000},context),/denied/);
  assert.equal(denied.calls.length,1);
  const f=fixture();await plugin.setup(f.ctx);
  for(const url of ['https://evil.test/','https://user:pass@x.bayleaf-proxies.dev/','https://x.bayleaf-proxies.dev/?token=secret']) {
    globalThis.fetch=(target,options)=>String(target).startsWith('http:')?f.fetcher(target,options):
      Response.json({url,expires_at:'2026-10-07T00:00:00Z'});
    await assert.rejects(()=>f.tools.get('bayleaf_expose').execute({port:8000},context),/Unexpected preview/);
  }
}));
