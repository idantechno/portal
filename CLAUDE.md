# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Portal Studio is

Multi-tenant SaaS that plugs businesses' WhatsApp Cloud API and a web chat widget into an AI agent powered by Anthropic Claude. Each business connects its own WhatsApp number once; inbound customer messages are queued, an agent worker calls Claude with that business's context (knowledge files, persona), and the reply is dispatched back over whichever channel the message came in on. The product is sold to other businesses — `idant` is the operator, not the only tenant.

For ongoing Meta/WhatsApp setup state (current blockers, IDs, what's been tried), read the auto-loaded memory in `~/.claude/projects/C--Users-idant-portal/memory/` — especially `project_meta_state.md`. Do not re-derive that from scratch.

## Stack

- **Backend**: NestJS 11 (TypeScript, Node 20, **pnpm 10.14.0**), TypeORM + Postgres, BullMQ + Redis, Socket.IO, `@anthropic-ai/claude-agent-sdk`, Zod, JWT auth.
- **Frontend**: Vite 8 + React 19 + Tailwind 4, react-query, react-router-dom 7, zustand, i18next, socket.io-client.
- **Containers**: Docker Compose for dev (`docker-compose.dev.yml`, hot reload) and prod (`docker-compose.yml`, nginx in front of SPA).
- **Prod hosting**: Railway, EU-West (Amsterdam). Backend at `https://api.portalstudio.co.il`. Marketing site is a separate Vercel app at `www.portalstudio.co.il` — out of this repo.

## Common commands

Use the Makefile for almost everything — it wraps Docker Compose with the right project names and host-port overrides.

```bash
make dev          # full dev stack: vite + nest --watch + postgres + redis (hot reload, debug on :9229)
make dev-down     # stop dev stack
make dev-logs     # tail dev logs
make dev-restart  # restart backend only

make up / down / logs / restart   # prod compose (nginx + nest + postgres)

make psql         # psql into the dev postgres container
make db-reset     # nuke dev DB volume and recreate
make clean        # tear down everything + prune volumes (dev + prod)
```

Per-side commands when you don't want the full stack:

```bash
# Backend (cd backend)
pnpm install
pnpm run start:dev          # nest --watch
pnpm run test               # jest, all unit tests
pnpm run test -- path/to/file.spec.ts   # run a single test file
pnpm run test -- -t "name"  # run tests matching name
pnpm run test:e2e
pnpm run test:cov
pnpm run lint               # eslint --fix
pnpm run build              # nest build → dist/

# Frontend (cd frontend)
pnpm install
pnpm dev                    # vite
pnpm build                  # tsc -b && vite build
pnpm lint                   # eslint .
```

`make test` runs backend Jest + frontend eslint (there is no frontend test runner configured).

## Architecture

The non-obvious parts that require reading multiple files:

### Channel abstraction (`src/channels/`)

`ChannelAdapter` is a single interface implemented by both `WhatsappChannelAdapter` and `WebChannelAdapter` (widget). The `ChannelRegistry` looks adapters up by `Channel` enum. The agent worker calls `channels.dispatch(conversation, reply)` and never knows which channel was used — this is what lets the same agent serve WhatsApp and the web widget identically. When adding a new channel, register an adapter; don't branch in the agent.

### Inbound message flow (the critical path)

1. `whatsapp-webhook.controller.ts` (path `/api/webhooks/whatsapp` because `setGlobalPrefix('api')` in `main.ts`) verifies the `X-Hub-Signature-256` HMAC against the raw body, finds the `WhatsappConnection` by `phone_number_id`, dedupes by `wamid`, appends the message as `MessageRole.Customer`.
2. `conversations.appendMessage()` is what enqueues the agent run job to BullMQ (queue name `agent-runs`, see `agent-worker.constants.ts`). Anything that adds a customer message should go through this path so the agent stays in sync.
3. `agent-worker.processor.ts` picks the job up. `agent-worker.service.ts` loads conversation history + business context, builds the system prompt, opens a `query()` against `@anthropic-ai/claude-agent-sdk` with a per-business `cwd`, then writes the bot's reply back through the channel adapter.

### Agent worker — unusual aspects

This codebase uses `@anthropic-ai/claude-agent-sdk` *inside a NestJS BullMQ worker*, not as a CLI. A few things follow from that:

- `cwd` is set to `filesystem.businessRoot(businessId)` — the agent's filesystem view is the tenant's directory under `BUSINESSES_DIR`.
- Allowed built-in tools are restricted to `Read`/`Glob`/`Grep`, and a `canUseTool` callback enforces **defense-in-depth path checking**: any file_path or path arg is resolved and rejected if it falls outside `cwd`. The cwd is *not* a sandbox — this guard is what prevents one tenant's agent from reading another's files via absolute paths or `../`.
- `settingSources: []` and `persistSession: false` keep the SDK from reading your `~/.claude` config or persisting session state across runs.
- A small custom MCP server (`createSdkMcpServer`) is built per run to expose `capture_lead` and `escalate_to_human` (`src/agent-worker/tools.ts`). The `agent-worker` is the only place these MCP tools are wired.

### Brief generator (`src/briefs/`) — questionnaire → business brief

Turns a `/strategy` submission into the full brief document. Three layers, each degrading on its own to `⟨לא ידוע⟩` rather than to invented text:

- **🔵 questionnaire** — `brief-facts.ts` maps the lead's stored `answers` back to typed facts. Items carry `id` now; older rows fall back to label matching against `questionnaire-schema.ts`, the **backend mirror of `frontend/src/questionnaire/schema.ts` that must be kept in sync**. `contradictions.ts` then flags answers that disagree with each other (deterministic, no model).
- **🟢 extraction** — `website-extractor.service.ts` crawls the business's own site (homepage + up to 4 same-origin pages) and asks the model what it actually says. Refuses non-public hosts — an operator-supplied URL must not become an SSRF probe.
- **🟠 drafting** — `brief-drafter.service.ts` produces positioning / personas / messaging. Every field it returns is stamped "טיוטה — טעון אישור" by the renderer.

`brief-renderer.ts` assembles the markdown deterministically — an empty slot prints `⟨לא ידוע⟩` because the renderer says so, not because a prompt asked. Both model steps go through `claude-json.service.ts` (Messages API, no agent loop, no tools; **no assistant prefill — the newer models reject it**). Model comes from `BRIEF_MODEL` (default `claude-opus-4-8`).

Access is **gated behind the `marketing` agent** (`@RequireAgent('marketing')` on `BriefsController`), so only businesses an admin has granted that agent can generate/read briefs. The entry point is the bespoke `MarketingAgent` page (`frontend/.../MarketingAgent.tsx`, wired into `AgentWorkspace`'s BESPOKE map): it lists questionnaire leads → generate (optional website) and existing briefs → open/delete. `BriefDetail` handles view/edit/copy/download/approve/regenerate(with website)/delete. There is no open "briefs" sidebar item.

`backend/scripts/brief-smoke.ts` runs the whole pipeline without a DB: `npx ts-node -T scripts/brief-smoke.ts [website]`.

### Multi-tenancy

`businessId` is the tenant scope and threads through every service call (`findByIdScoped`, `listMessages(businessId, ...)`, etc.). Per-business filesystem state lives under `BUSINESSES_DIR` (env var, default `/data/businesses` inside the container, bind-mounted from `BUSINESSES_HOST_DIR` on the host). When adding queries or repositories, always scope by `businessId` — there is no global "all tenants" view.

### WhatsApp Cloud API is SaaS-shaped

Customers do NOT bring their own Meta Developer App. The app is ours (one `META_APP_ID`, one webhook URL). Customers will connect their WABA through Embedded Signup (Meta's official partner flow) and we store per-business access tokens encrypted with `APP_ENCRYPTION_KEY` (AES, see `common/crypto/`). The Embedded Signup UI is not yet built — for now connections can be seeded manually.

### Why `rawBody: true`

`main.ts` enables `rawBody: true` because Meta signs the **raw body bytes** with the App Secret. If the body is parsed-then-restringified, the HMAC won't match. The webhook controller reads `req.rawBody` (Buffer) directly. Don't change this without re-verifying the signature path.

## Design system

The visual language is centralised — don't hand-roll UI chrome.

- **Icons: `frontend/src/components/icons.tsx` is the only source.** ~66 hand-drawn outline glyphs on a 24 grid, 1.6 stroke, round caps, `currentColor`. **No emoji anywhere in the product**, and no one-off inline `<svg>` — if a glyph is missing, add it to the set following the rules in that file's header. Verify additions at `/dev/icons` (dev-only route; the chunk is folded out of production builds).
- **Backend sends icon *slugs*, not glyphs.** `agent-catalog.ts`, `integration.constants.ts`, and `weather-codes.ts` carry names like `'compass'` / `'receipt'`; the frontend resolves them through `<ServerIcon>`, which falls back safely on an unknown slug. Adding a catalog entry means adding the matching glyph.
- **Directional glyphs mirror themselves.** Use `arrow-start`/`chevron-start` for back/previous and `-end` for forward/next; the `Icon` component tags them `icon-dir` and CSS flips them under `[dir="rtl"]`. Never a literal `←`/`→`/`›` in JSX — those don't mirror and read as stray characters.
- **Primitives live in `components/ui.tsx`**: `Button` (takes an `icon` prop), `Card`, `IconTile`, `Badge`, `SectionTitle`, `EmptyState`, `FormError`. Icons outside buttons and nav rows belong in an `IconTile` so sizes and paddings can't drift.
- **Tokens in `index.css`**: elevation `--shadow-e1/e2/e3` (navy-tinted, three steps only), one easing curve `--ease-out-brand`, and the `.app-canvas` / `.eyebrow` / `.hairline` utilities.
- **Three type families, no more.** Rubik (`font-sans`), Frank Ruhl Libre (`font-display`, auto-applied to `h1/h2/h3`), and a system mono stack (`font-mono`). Heebo/Alef are scoped to the public `/strategy` questionnaire, which follows the marketing site's brand. Customer-facing output — the work-order PDF template, designer-agent HTML, the chat widget — must use the same pairing.

## Gotchas

- **`DB_SYNCHRONIZE=true` is dev-only.** Production must switch to TypeORM migrations before any real customer data lands.
- **Routes vs. controller paths.** Controllers use plain paths (`@Controller('webhooks/whatsapp')`), but `setGlobalPrefix('api')` means the actual URL is `/api/webhooks/whatsapp`. Important for anyone configuring webhooks externally (Meta, Stripe, etc.).
- **`DB_LOGGING=true` in dev compose** — it's loud. Override with `DB_LOGGING=false` in `.env` if it gets in the way.
- **Redis auth in prod.** `REDIS_USERNAME` + `REDIS_PASSWORD` are required for the managed Redis on Railway; locally Redis is open. The BullMQ connection config reads both (see `app.module.ts`).
- **No `CLAUDE.md` in `backend/` or `frontend/`** — this root file is the only one, both projects share the same operator conventions.

## Out of scope for this repo

- The Vercel marketing site (`www.portalstudio.co.il`) is in a separate repo. Don't touch DNS/SEO/landing content from here.
- Client-specific landing pages and assets live under `C:\Users\idant\clients\<slug>\{website,assets}`, NOT in this repo.
