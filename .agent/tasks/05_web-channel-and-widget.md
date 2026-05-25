# Session 5 — Web channel + embeddable widget (tasks #17, #18)

Continue building the portal chatbot SaaS. Read MEMORY.md first.

State: WhatsApp works, inbox + admin UI are in. The dashboard is functional.
Now add the second channel — an embeddable web widget — so businesses
without WhatsApp (or who want both) can deploy the bot on their website.

## #17 — Web channel adapter + public widget endpoints

- Public endpoints (no JWT, scoped by `business.publicKey`):
  - `POST /api/widget/:publicKey/session` — create anon `CustomerContact`
    (`channel=web`, `externalId=` generated session token) + `Conversation`;
    return `{ sessionToken, conversationId }`
  - `POST /api/widget/session/:sessionToken/messages` — customer sends a
    message; persist; enqueue `agent-run`
  - `GET /api/widget/session/:sessionToken/messages` — initial load
- Mark with `@Public`
- CORS allowlist per business (new column `business.widget_allowed_origins`
  jsonb array). Validate `Origin` header against it.
- Socket.IO namespace `/widget`: client joins room `conversation:{convId}`
  via sessionToken; server emits bot/agent replies (use the same emission
  hook as the inbox gateway — both rooms get the event)
- `WebChannelAdapter implements ChannelAdapter`; on send, emits to the
  `/widget` conversation room (no external API call)
- Self-register with `ChannelRegistry`

## #18 — Embeddable widget bundle

- New Vite project at `frontend/widget/` (separate entry, separate
  `package.json` or workspace)
- `<script src="/widget.js" data-public-key="..."></script>`
- Mounts a shadow DOM root with a floating bubble + chat panel
- Hebrew/English auto-detection via `navigator.language`; allow override via
  `data-locale`
- Persists `sessionToken` in localStorage
- Streams bot replies (Socket.IO)
- Shows "Agent joined" event when status flips to human (subscribe to
  `conversation.updated`)
- Build output served by the backend at `/widget.js` (static)
- In the business admin settings UI (#10), add a "Web widget" card with
  copy-snippet button + allowed-origins editor

## Acceptance

Drop the snippet on a plain HTML page (test page in `frontend/widget/test/`),
open in browser, chat with the bot, capture a lead, trigger escalation, see
an agent reply land in real time. Conversation also shows in the dashboard
inbox.

Stop after #17 + #18. Smoke test is the next session.
