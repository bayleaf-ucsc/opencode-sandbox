---
name: bayleaf-rooms
description: Use when building a static web app (GitHub Pages, a preview, an HTML file) where several people or agents must share live or saved state without running a server: class activities, shared boards, polls, live cursors or hands up, co-editing a document. BayLeaf Rooms stores and relays; it never runs code, inference or agents. Not for grades, rosters, official records or private per-user storage.
---

# BayLeaf Rooms

Before writing code, fetch the current contract:
`https://api.bayleaf.dev/docs/rooms.md` (and `https://api.bayleaf.dev/llms.txt`
for the wider API). It is authoritative; this skill is a short orientation.

A room is a durable log that link holders append to and read, with live
WebSocket delivery and HTTP catch-up. It keeps state while every browser,
sandbox and agent is off. BayLeaf relays, it does not arbitrate: no locks or
turns; design the app so participants converge.

## When to offer one

Offer a room, and ask before creating it, when the user wants several people to
see each other's input from a page they host: "students post sticky notes live",
"a shared outline we edit together", "everyone taps the slide to show where
they're confused". Use a room for the live activity only: anything graded or kept
as a record is submitted elsewhere (Canvas, a form, a repo).

## Two planes, two credentials

| Plane | Host | Credential |
|---|---|---|
| Owner (you, in this sandbox) | `https://api.bayleaf.dev/rooms` | `$BAYLEAF_API_KEY` |
| Participant (the app) | `https://bayleaf-rooms.dev/{room_id}` | room link key `rk_...` |

`$BAYLEAF_API_KEY` works only toward `api.bayleaf.dev`. Never print it, never
send it to `bayleaf-rooms.dev`, and never put it in an app, page, repo or link.

```bash
A="Authorization: Bearer $BAYLEAF_API_KEY"; J='Content-Type: application/json'
curl -sS -H "$A" https://api.bayleaf.dev/rooms/limits          # call first
curl -sS -H "$A" -H "$J" -X POST https://api.bayleaf.dev/rooms \
  -d '{"label":"week3-board","codec":"json","expires_at":"2026-12-15T00:00:00Z"}'
curl -sS -H "$A" -H "$J" -X POST https://api.bayleaf.dev/rooms/ROOM_ID/credentials \
  -d '{"scopes":["presence","append"],"labels":["s01","s02","s03"]}'
```

Other owner calls: `GET /rooms`, `GET /rooms/ROOM_ID`,
`GET|DELETE /rooms/ROOM_ID/credentials[/CRED_ID]`, `PATCH /rooms/ROOM_ID`
(`expires_at`, `label`, `"mode":"read_only"` to freeze), `GET /rooms/ROOM_ID/export`,
`DELETE /rooms/ROOM_ID`. Ask the user before delete, revoke or freeze.

## Capability links and scopes

Each credential returns `secret` (shown once) and `link_fragment`
(`room=...&key=...`). Share `https://APP_URL/#` plus the fragment: browsers never
send the fragment to the page host, so page source holds no secrets. Do not echo
secrets into files you commit or into chat beyond what the user needs to hand out.

Every link can read and export the whole room and see presence. Scopes add:
`presence` (send cursors, names), `append` (write), `manage` (redact, JSON rooms only).
Give each link only what its holder needs. **A link that will be projected, shown
on a slide, put in a QR code or recorded must be presence-only**
(`"scopes":["presence"]`): anyone who sees it holds it. Labels are visible to
every participant: use pseudonyms, never real names. One link per person gives
per-person attribution in JSON rooms.

## Codec

- `json` (default): self-contained events, rebuilt by replay; apps write their own
  fetch/WebSocket code from the contract.
- `yjs`: co-editing text, outlines, whiteboards. Use the official provider, do not
  write your own sync:
  `import { BayLeafRoomProvider } from "https://bayleaf-rooms.dev/client/y-bayleaf@1.js"`
  (pinned major), with `yjs@13` and `y-protocols@1` from esm.sh. With an editor,
  copy the tested import map from the contract (Tiptap 3, one Yjs, one
  ProseMirror). Lock the editor unless `provider.can("append")` and status is
  `connected`; tell the user to reload on `diverged`. The codec is fixed at creation.

## Lifetime and privacy

- A room ends at `expires_at`: default 30 days, at most 90 days ahead. Use never
  extends it; only the owner's `PATCH` does. Leave a buffer for export. Deletion
  and expiry end the relay for everyone; warn participants first.
- Room content is **stored**, outside BayLeaf's zero-data-retention and
  zero-operator-access posture: the operator can technically read it, and
  deleted rooms stay recoverable from provider backups for up to 30 days.
  Presence is relayed, never stored. Keep grades, rosters, real-name mappings,
  secrets and P4 data out of rooms.
- Errors: `403` missing scope, `404` unknown, expired or not yours, `409`
  frozen, `413` too large, `429` rate or socket limit (honor `Retry-After`),
  `507` room full. If every `/rooms` call returns 404, Rooms may be disabled:
  say so plainly.
