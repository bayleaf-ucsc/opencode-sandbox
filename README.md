# BayLeaf sandbox plugin

BayLeaf-specific web tools and curated skills for hosted OpenCode V2 agents.
Tested with OpenCode 2.0.23.

- Registers BayLeaf as a provider for native `websearch`.
- Replaces `webfetch` with BayLeaf public-page extraction, preserving URL-level
  allow/ask/deny permissions through the authenticated local OpenCode API.
- Adds `bayleaf_usage`, `bayleaf_expose`, and
  `bayleaf_unexpose`. Read-only inspection has no lifecycle effects; preview
  mutations request permission with port and access scope as the resource.
- Registers environment guidance and a scheduling-lifecycle skill directly from
  `skills/`. Scheduling remains OpenChamber's tool surface, not a plugin tool.

The managed environment supplies `BAYLEAF_API_KEY`, `BAYLEAF_OPENCODE_URL`
and `OPENCODE_PASSWORD`. Search and extraction use BayLeaf's plaintext web
facet (Tavily), not Sealed inference. Fetch supports markdown and text extraction,
not raw HTML, authenticated pages, arbitrary API responses, or binary downloads.

## Installation

The BayLeaf launcher configures the environment and well-known connection.
Its remote config disables native `opencode.tool.webfetch`, selects the BayLeaf
search provider, and installs this repository at a full commit hash:

```json
{"plugins":["-opencode.tool.webfetch","github:bayleaf-ucsc/opencode-sandbox#<full-commit-sha>"],"websearch":{"provider":"bayleaf"}}
```

This package has no runtime dependencies or build step. Skills are canonical
source files here. Run `npm test` for the plugin unit tests.

## Delivery

The main BayLeaf repository includes this repository as `api/sandbox-plugin`.
Its build derives the remote-config pin from the submodule checkout and rejects
uncommitted plugin changes. Push the plugin commit before deploying the Worker.
The main repository's submodule update can remain uncommitted during production
evaluation. No npm publication is involved.

Running OpenCode locations refresh remote configuration every ten minutes.
Changing the exact Git pin delivers a new package; restarting is not required.
Sleeping sandboxes pick up current configuration on their next launch.
Remote outages do not promise last-known-good configuration retention. The
launcher keeps native direct fetch disabled even when remote definitions vanish.
