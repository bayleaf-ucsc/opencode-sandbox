---
name: bayleaf-sandbox-technique
description: Understand your environment as an OpenCode/OpenChamber agent inside a BayLeaf sandbox. Use for questions about available inference budget, model access, sandbox persistence, browser previews, credentials, BayLeaf services, privacy, or what this platform is and who operates it.
---

# Your BayLeaf sandbox

You are running in a persistent Linux sandbox shared with BayLeaf Chat and the
sandbox API. OpenChamber is the browser interface; OpenCode runs the agent.
Your default project is `/home/daytona/workspace`. Browser users are on a
different computer: their localhost is not this sandbox's localhost.

## Live self-knowledge

Run the helper relative to this skill's directory:

```sh
python3 scripts/status.py usage
python3 scripts/status.py sandbox
python3 scripts/status.py browser
```

- `usage` reads `/usage`: standard inference spend and enabled request-count
  allowances, including Sealed. It does not spend inference credits, provision
  provider keys, or start compute. It reports when a budget is unavailable.
- `sandbox` reads `/sandbox`: machine status and resources without waking it.
- `browser` reads `/sandbox/browser/status`: work-period and setup metadata.

Budgets are shared with the owner's other clients, not assigned to this session.
USD and request counts are different units; never add them. A null budget is
unknown, not unlimited. Use returned timestamps/reset fields; do not infer today's
spend from lifetime usage. Sealed's allowance does not mean this running agent
uses Sealed: its normal BayLeaf provider is the standard plaintext lane.

The helper reads the owner's credential internally from
`~/.local/share/bayleaf/browser/credentials/owner-key`, with an environment fallback.
Never display that file, print the environment, enable shell/HTTP tracing, or put
a credential in a tool argument. Report the helper's safe results, not raw auth
responses. Installed helper source contains no secrets and can be inspected.

## Platform questions

For purpose, capabilities, and institutional context, read **https://bayleaf.dev**.
BayLeaf is a situated counterplatform for Generative AI at UC Santa Cruz,
operated by Adam Smith. For details, follow the public sources:

- https://github.com/bayleaf-ucsc/bayleaf
- https://raw.githubusercontent.com/bayleaf-ucsc/bayleaf/main/PRIVACY.md
- https://raw.githubusercontent.com/bayleaf-ucsc/bayleaf/main/api/SANDBOX-BROWSER.md
- https://api.bayleaf.dev/llms.txt
- https://api.bayleaf.dev/docs/openapi.json

Use live API results for the current account and machine. Public repo `main`
can lag deployed code; do not treat an absent document or older revision as proof
that a live feature is unavailable. Name the source when resolving a discrepancy.
Fetch relevant documents on demand rather than cloning or reading the whole repo.

## What persists and what expires

- Files and agent histories persist in the sandbox. Processes and terminals do
  not survive sleep. Deleting the sandbox destroys these files and histories.
- Dashboard browser access lasts up to six hours and requires deliberate renewal.
  Idle sleep can happen earlier. Passive status checks do not renew work.
- Setup uses isolated tooling under `~/.local/share/bayleaf/browser`; it does not
  replace global OpenCode or project configuration.
- BayLeaf-provided skills and their helpers live in a versioned plugin package.
  Remote configuration delivers reviewed updates while OpenCode is running.
  Put personal additions in your own skill folder, not the installed package.
- To preview a running website, load **expose-sandbox-ports-technique**.
  Prefer private exposure; bind the service to 0.0.0.0. Port 3100 is reserved.
- Inference uses BayLeaf's approved ZDR providers. Sandbox files, histories, and
  credentials deliberately persist and are not zero-operator-access storage.

Do not promise capabilities based on a model's training knowledge. Check current
tools, configuration, API responses, and the relevant platform documentation.
