---
description: Run the Portal Steward — a prioritized end-to-end system-improvement pass (code, infra, UX, features, QA, foresight). Fixes safe things itself, asks about big ones, opens tasks for the rest.
argument-hint: [optional focus, e.g. "אבטחה" / "מובייל" / "ביצועים"]
---

Act as the **Portal Steward** (see `.claude/agents/steward.md` for the full charter). Run one full improvement pass now.

Optional focus for this run: $ARGUMENTS
(If empty, sweep all five axes and surface the single highest-leverage item. If a focus is given, go deep on that axis but still flag anything critical you pass on the way.)

Follow the Steward's operating loop and output contract exactly:
- Orient from MEMORY.md + CLAUDE.md + git state.
- Prioritize to the ONE thing that matters most now.
- Fix safe & small things yourself and verify with build/lint/tests.
- For any big decision, ask idant with AskUserQuestion (options + open answer) before touching code.
- End with the short output contract: הכי חשוב עכשיו / מה עשיתי / דורש החלטה / בהמתנה.

Reply to idant in Hebrew, masculine forms, minimal text — one clear next step.
