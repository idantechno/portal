# Session 3 — WhatsApp channel (tasks #15, #16)

Continue building the portal chatbot SaaS. Read MEMORY.md first.

State: agent worker + tools (#13, #14) are done. Now build the first real
channel adapter so the bot can talk over WhatsApp.

## #15 — WhatsApp Cloud API adapter

- New entity: `WhatsappConnection` (`business_id, phone_number_id, waba_id,
  display_phone_number, access_token_encrypted, app_secret_encrypted,
  verify_token, status: pending|active|failed, last_error, connected_at`).
  Encrypt tokens at rest with AES-256-GCM, key from new env var
  `APP_ENCRYPTION_KEY` (32 bytes b64).
- Service: `WhatsappConnectionsService` (CRUD + decrypt-on-read)
- Inbound:
  - `GET /api/webhooks/whatsapp` — Meta verify-challenge handshake
    (`hub.mode`, `hub.verify_token`, `hub.challenge`); look up the connection
    by `verify_token`
  - `POST /api/webhooks/whatsapp` — verify `X-Hub-Signature-256` against the
    connection's `app_secret`; parse the message; resolve business via
    `phone_number_id`; upsert `CustomerContact` by phone; persist inbound
    `Message`; enqueue `agent-run` job
  - Mark these endpoints `@Public` (no JWT)
  - De-dupe on the wamid (`Message.externalMessageId`)
- Outbound:
  - `WhatsappChannelAdapter implements ChannelAdapter`; POSTs to
    `graph.facebook.com/v21.0/{phone_number_id}/messages` with the right
    text payload; returns the wamid
  - Self-register with `ChannelRegistry` on module init
- Add a debug table `whatsapp_webhook_events` (`id, business_id nullable,
  raw_payload jsonb, signature_ok, created_at`) — log every inbound payload
  for the first month of operation

## #16 — WhatsApp settings UI (frontend)

- Route `/app/businesses/:id/channels/whatsapp`
- Form: `phone_number_id`, `waba_id`, `access_token` (masked input),
  `app_secret` (masked), `verify_token` (we GENERATE + display, business
  pastes into Meta dashboard)
- Display the webhook URL to register in Meta
- "Test connection" button: backend endpoint that calls
  `graph.facebook.com/{phone_number_id}` with the token; reports success
- Status badge (pending/active/failed) + `last_error`
- Hebrew + English copy + RTL
- Inline checklist of Meta dashboard steps

## Acceptance

With real WABA creds pasted, an incoming WhatsApp message triggers the agent
worker, which dispatches a reply back to the customer phone via Cloud API.
End-to-end on a single test number.

Stop after #15 + #16. Don't build inbox/admin UI or web widget yet.
