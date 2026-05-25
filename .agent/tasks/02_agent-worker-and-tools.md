# Session 2 — Agent worker + tools (tasks #13, #14)

Continue building the portal chatbot SaaS. Read MEMORY.md first — especially
architecture-decisions and tenancy-pattern.

State: Backend foundation (auth, businesses, context-files, conversations,
channels registry) is done and the dev stack boots cleanly. See task list for
completed work. Verify with `make dev` — host ports are shifted (backend 3010,
postgres 5434, redis 6382, frontend 5180). Standard happy path was smoke-
tested in the previous session.

Now build tasks #13 + #14:

## #13 — Agent worker

- BullMQ queue `agent-runs` (use `@nestjs/bullmq` + `ioredis`, `REDIS_HOST`/
  `REDIS_PORT` from env)
- Job payload: `{ conversationId, businessId, latestMessageId }`
- Worker:
  - Read the Claude Agent SDK API surface from
    `backend/node_modules/.pnpm/@anthropic-ai+claude-agent-sdk@*/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts`
    BEFORE writing the worker
  - Load conversation + recent messages from `ConversationsService`
  - Run the SDK with `cwd = ${BUSINESSES_DIR}/${businessId}/`
  - System prompt: base template + `business.systemPromptOverride`
  - Allowed builtin tools: `Read`, `Glob`, `Grep` (the agent should self-navigate
    the business folder like Claude Code on a repo)
  - Custom tools: `capture_lead`, `escalate_to_human` (#14)
  - On completion: persist assistant messages via `ConversationsService`,
    then `ChannelRegistry.dispatch()` to send over the channel
  - Skip the run if `conversation.status === 'human'`
  - Default model from `AGENT_MODEL` env (`claude-sonnet-4-6`)
- The conversation domain's `appendMessage` for inbound (customer) messages
  should enqueue an `agent-run` job. Wire that in `conversations.service` or
  a listener.
- Module: `backend/src/agent-worker/` — module, service, processor

## #14 — Tools

- `capture_lead(name, phone?, email?, interest, notes?)` — creates a Lead row
  (new entity: `id, business_id, conversation_id, customer_contact_id, name,
  phone, email, interest, notes, created_at`) + GET endpoint
  `/api/businesses/:businessId/leads`
- `escalate_to_human(reason, summary)` — flips `conversation.status` to
  `'human'` via `ConversationsService.takeover` (no agent assigned), returns
  a Hebrew/English confirmation back to the customer
- Both tools receive `businessId` implicitly from worker context — never let
  the model pass `businessId`

## Acceptance

With `ANTHROPIC_API_KEY` set in `.env`, enqueue an `agent-run` job for an
existing conversation; the bot persists a reply message and (later, once
channels are wired) dispatches it. Tools work when the model calls them.

Stop after #13 + #14. Don't start WhatsApp.
