---
name: expose-sandbox-ports-technique
description: Open a website or dev server running inside this BayLeaf sandbox in the user's browser. Use when launching Python HTTP servers, previewing web apps, sharing a sandbox port, or fixing inaccessible localhost links. Obtain a private BayLeaf preview URL with the bundled helper without displaying credentials.
---

# Expose sandbox ports

The user's browser is outside this Linux sandbox. A `localhost` link points to
their computer, not this one. After starting a web service, expose it through
BayLeaf and give the user the returned HTTPS URL.

## Workflow

1. Choose an unused port from 3000–9999, except 3100 (reserved for OpenChamber).
2. Bind the service to **0.0.0.0**, not only localhost. For a Python demo, serve
   only its intended directory: `python3 -m http.server 8000 --bind 0.0.0.0 --directory ./site`.
   Start it using the shell tool's background-process facility. Never serve the
   home directory, credential/configuration directories, or the entire filesystem.
3. Verify the service locally, for example `curl --fail http://127.0.0.1:8000/`.
4. Run the bundled helper (paths below are relative to this skill's directory):

   ```sh
   python3 scripts/expose.py 8000
   ```

5. Share the returned `url`. **Private is strongly recommended**: it requires
   the sandbox owner's BayLeaf login. It is not a collaboration link for other
   logged-in users. Tell the user this if they ask to share it with someone else.

Use public access only when the user explicitly asks for a publicly accessible
service and the served files/app are intended for that audience:

```sh
python3 scripts/expose.py 8000 --access public
```

Public means no BayLeaf login is required. A request to “preview” or “open” a
page is not a request to publish it. Do not make a preview public just to fix
a login or connectivity problem.

## Credential handling

**Use the helper. Do not read the key into tool output or model context.** It
reads `~/.local/share/bayleaf/browser/credentials/owner-key` internally, falling
back to `BAYLEAF_API_KEY`, then calls the fixed BayLeaf API origin. Commands,
stdout, stderr, and handled errors contain no key or Authorization header.

Never `cat` the credential, print environment variables, use shell tracing,
pass a literal key in argv, enable HTTP debug logging, or rewrite this as a
verbose curl request. Do not include keys in screenshots, chat, or reports.
The helper source itself contains no credential and is safe to inspect.

## Lifetime and recovery

- Exposure does not start a service, wake compute, or keep the sandbox awake.
- The returned expiry is authoritative. Port previews currently last 24 hours,
  independently of OpenChamber's six-hour browser work period.
- Re-exposing the same port replaces its old URL. Reuse the existing URL until
  it expires or you need to change access. Old browser tabs then need the new URL.
- To revoke access without stopping the service:
  `python3 scripts/expose.py 8000 --revoke`.
- If the page cannot connect, check that the server is still running and bound
  to 0.0.0.0. Sleep stops running processes; resume and restart the service.
- Do not request or display a raw Daytona signed URL. Give only the wrapped
  `bayleaf-proxies.dev` URL returned by the helper.

## Evidence

Uses BayLeaf's keyed `/sandbox/expose` endpoint and port-scoped revocation.
Packaged for the managed sandbox installation, October 2026. The helper keeps
credentials out of its normal invocation/output path; it is not a security
boundary against arbitrary code running as the sandbox owner.
