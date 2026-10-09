---
name: bayleaf-sandboxes
description: Understand the BayLeaf Sandbox shared workspace, persistence, previews, budgets, privacy, and connections to Chat and the API. Use when environment context is needed beyond tool descriptions.
---

# BayLeaf Sandbox

BayLeaf Sandbox is a persistent, isolated workspace where you and an AI agent
can build, run, and preview projects through a browser. The browser workspace,
Chat's Lathe tools, and the BayLeaf API operate on the same files and processes.
OpenChamber supplies the browser interface; OpenCode runs the agent; Daytona
supplies the underlying Linux sandbox. These are implementation details, not
separate user workspaces.

Your default project is `/home/daytona/workspace`. The user's computer is
elsewhere: their localhost is not this sandbox's localhost.

## Use the tools directly

- `bayleaf_usage`: current budgets and allowances, without spending inference.
- `bayleaf_expose`: expose a running web server's port. Private is the default;
  public means anyone with the URL can access it. Explicitly choose that scope.
- `bayleaf_unexpose`: revoke a port's preview without stopping its server.
- `websearch` and `webfetch`: BayLeaf search and public-page extraction.
- Before scheduling delayed or recurring work with OpenChamber `schedule.*`,
  load `bayleaf-scheduling`: persistent task definitions do not keep compute awake.

Platform credentials are supplied internally. Never print them or the environment,
enable HTTP tracing, or put platform credentials in tool arguments.

## Preview a project

Start its web server using the shell, bind to `0.0.0.0`, and select a port in
3000–9999 except reserved port 3100. Check localhost from inside the sandbox,
then call `bayleaf_expose`. Give the user the returned HTTPS URL, not localhost
or a raw provider proxy URL. Private URLs require owner login. Re-exposing the
same port replaces its preview. Stop the server separately when finished.
Use localhost tools for internal checks: `webfetch` cannot read private previews.

Optional `upstream_headers` configures fixed application headers in either access
mode, for example `{"X-Authenticated-Owner":"true"}` or an application-only
`Authorization` credential (including Basic). It is ordinary proxy configuration,
not a separate approval or an identity mapping. Private owner login still happens
first; public visitors can exercise injected credentials. Values overwrite browser
headers case-insensitively on HTTP and WebSocket handshakes. Nonempty headers must
receive `upstream_headers_applied: true`; never fall back to a raw provider URL.
Use at most 16 entries, 64-byte HTTP-token names, 4096-byte printable ASCII values,
and 8192 total name/value bytes. Routing, framing, transport, browser-security and
provider-reserved headers are rejected. Never use BayLeaf, installation, session,
or provider credentials as app credentials. Application credentials in these tool
arguments remain in agent history and applications may reflect them. Header
assertions alone neither identify visitors nor prevent direct-upstream spoofing:
qualify the app's trusted-peer and alternate-route boundary separately.

## Persistence and budgets

- Files and agent histories persist. Processes do not survive sleep. Deleting
  the sandbox destroys its files and histories.
- Private browser links last up to 24 hours. There is no work-session extension
  or end-session action. If a link expires or the sandbox sleeps, return to
  https://api.bayleaf.dev/ to resume. Link expiry does not stop applications.
  New sandboxes stop after 1 hour idle and archive after 24 hours stopped;
  sandbox data is reaped after 90 days without recorded activity. Passive
  status checks do not keep compute awake.
- Budgets are shared with the owner's other clients. Dollars and request counts
  are different units. Null is unknown, not unlimited or zero. Use response
  timestamps/reset fields; lifetime usage is not today's usage.
- A Sealed allowance does not mean this agent uses Sealed. The normal configured
  provider uses the standard plaintext inference lane with ZDR providers.
- Sandbox files, histories, and credentials deliberately persist. This storage
  is not zero-operator-access storage.

## Platform context

BayLeaf is a situated counterplatform for Generative AI at UC Santa Cruz,
operated by Adam Smith. Consult https://bayleaf.dev, the public repository at
https://github.com/bayleaf-ucsc/bayleaf, its PRIVACY.md, and
https://api.bayleaf.dev/docs/openapi.json when relevant. Live API results describe
the current account and machine; public main can lag deployment.

Plugin tools and skills update through remote configuration while OpenCode is
running. Put personal skills in your own skill folder, not the installed package.
