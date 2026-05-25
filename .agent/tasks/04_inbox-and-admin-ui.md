# Session 4 — Inbox + business admin UI (tasks #9, #10)

Continue building the portal chatbot SaaS. Read MEMORY.md first.

State: WhatsApp channel works end-to-end (agent answers WhatsApp messages).
Frontend is still the Vite/React bootstrap with no auth, no routing. Now
build the human-facing dashboard so business owners can manage their bot
and take over conversations.

## Pre-work — frontend app shell

Scaffold first; the two main tasks below sit on top of this:

- `react-router` routes: `/login`, `/signup`, `/app` (authed shell with
  sidebar), `/app/businesses/:id/...`
- Auth store (Zustand) — JWT in localStorage, axios interceptor adds Bearer
- TanStack Query client + a small typed API client wrapper (axios)
- i18n: `i18next` + `react-i18next` with `he` (default) + `en` locale, RTL
  handled via `dir={i18n.dir()}` on `<html>` + Tailwind logical properties
- Layout: top bar + sidebar (Inbox, Files, Channels, Settings, Members,
  Leads)
- Login + signup pages — minimal but production-feeling design (Tailwind 4,
  Hebrew-first typography stack)

## #9 — Inbox UI

- `/app/businesses/:id/inbox` — split view: left = conversation list with
  tabs (Bot | Human | All | Closed), right = active thread
- Thread: messages styled by role (customer | bot | agent | tool collapsed)
- Composer: when an agent sends, calls
  `POST .../conversations/:id/messages` (server-side this triggers takeover
  automatically — already implemented)
- "Return to bot" button → `POST .../return-to-bot`
- Socket.IO: build the inbox gateway server-side too (was deferred from #5):
  namespace `/inbox`, room `business:{businessId}`, emit events:
  `conversation.created`, `conversation.updated`, `message.created`
  when the agent worker or the inbound webhook persists data. Wire it.
- Frontend connects to `/inbox` namespace, joins the business room, updates
  react-query caches on events
- Hebrew + RTL throughout

## #10 — Business admin UI

- `/app/businesses/:id/files` — drag-drop upload, list, delete; `global_admin`
  sees a "Hidden files" tab and an "Upload as hidden" toggle
- `/app/businesses/:id/settings` — name, slug, `publicKey` display + copy,
  `systemPromptOverride` textarea, members list with add/remove
- `/app/businesses/:id/leads` — list captured leads (read-only)
- Use TanStack Query everywhere

## Acceptance

Business owner can log in, upload context files, open a live WhatsApp
conversation in the inbox, take over, reply, return-to-bot. Hidden files
are invisible to non-global-admin users.

Stop after #9 + #10. Don't build web widget yet.
