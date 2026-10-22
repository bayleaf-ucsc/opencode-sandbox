# BayLeaf sandbox plugin

BayLeaf-specific web tools and curated skills for hosted OpenCode V2 agents.
Tested with OpenCode 2.0.23.

- Registers BayLeaf as a provider for native `websearch`.
- Replaces `webfetch` with BayLeaf public-page extraction, preserving URL-level
  allow/ask/deny permissions through the authenticated local OpenCode API.
- Adds `bayleaf_usage`, `bayleaf_expose`, and
  `bayleaf_unexpose`. Read-only inspection has no lifecycle effects; preview
  mutations request permission with port and access scope as the resource.
- Adds BayLeaf Inboxes tools over the API's `/inboxes` owner facade. Reads need
  no approval: `bayleaf_inboxes`, `bayleaf_inbox_messages` (list/search),
  `bayleaf_inbox_read` (metadata and extracted text in
  `<untrusted_inbox_content>` markers) and `bayleaf_inbox_save` (exact body or
  attachment bytes to a non-clobbering path confined to the working directory,
  26 MiB cap; every save uses native permission with the exact destination path,
  since sender bytes can plant agent instructions or configuration). Mutations request
  permission: `bayleaf_inbox_create` (resource includes type, http `access` (`open` or `closed`,
  required for http and rejected for email) and any explicit lifetime),
  `bayleaf_inbox_archive`, `bayleaf_inbox_delete_message` and
  `bayleaf_inbox_destroy` (resource names the address). Webhook sender tokens
  are deliberately not tools, so minted tokens never enter model context.
- Creation accepts `ttl_seconds` (60–2592000) or `preset: "experiment"` (15
  minutes), never both. `bayleaf_inbox_lifetime` sets/shortens a deadline under
  native approval; it cannot extend or remove one. Expiry destroys the endpoint
  and stored content. Inbox results retain `expires_at` and `cleanup_not_before`.
  `bayleaf_inbox_events` reads one bounded finite arrival page, retaining empty
  checkpoints and mapping HTTP 410 to replay/resynchronization guidance. It does
  not start a background watcher. Live SSE and bulk export remain explicitly
  requested script/API workflows described in the inbox skill.
- Registers environment guidance plus scheduling-lifecycle and inbox skills
  directly from `skills/`. Scheduling remains OpenChamber's tool surface, not a
  plugin tool.

The managed environment supplies `BAYLEAF_API_KEY`, `BAYLEAF_OPENCODE_URL`
and `OPENCODE_PASSWORD`. Search and extraction use BayLeaf's plaintext web
facet (Tavily), not Sealed inference. Fetch supports markdown and text extraction,
not raw HTML, authenticated pages, arbitrary API responses, or binary downloads.

## Installation

Inboxes tools and the `bayleaf-inboxes` skill are disabled by default. The managed
installer must supply `BAYLEAF_INBOXES_ENABLED=true` to the OpenCode process only
when the API's Inboxes feature is enabled. Any other value omits both registrations
and skips loading that skill. Setup performs no network capability checks. This
environment flag is captured at plugin setup: changing it requires reloading the
plugin/process (and updating existing sandbox environments), not just refreshing
remote configuration. Installer wiring is outside this package.

The BayLeaf launcher configures the environment and well-known connection.
Its remote config disables native `opencode.tool.webfetch`, selects the BayLeaf
search provider, and installs this repository at a full commit hash:

```json
{"plugins":["-opencode.tool.webfetch","github:bayleaf-ucsc/opencode-sandbox#<full-commit-sha>"],"websearch":{"provider":"bayleaf"}}
```

This package has no npm runtime dependencies or build step. Inbox saves require
`python3`, an existing dependency in hosted Linux (also required on macOS test
hosts). A fixed isolated helper inherits an open workspace directory descriptor,
traverses children without following symlinks, and publishes relative to the held
parent descriptor. Approval or download waits cannot redirect writes by swapping
a directory pathname. Downloads are bounded to 26 MiB in memory before any write;
temporary files stay in the destination directory. No shell or credential
environment is passed to the helper. Skills are canonical source files here.
Run `npm test` for the plugin unit tests.

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
