# Session 6 — End-to-end smoke test + polish (task #19)

Continue building the portal chatbot SaaS. Read MEMORY.md first.

State: all of slice 1 is built — auth, multi-tenancy, files, conversations,
agent worker + tools, WhatsApp channel, web channel, dashboard, widget.

Now run a thorough end-to-end smoke test and fix anything that breaks:

1. Bring up a clean dev stack (`make clean && make dev`).
2. As a fresh business owner:
   - Signup, create a business "Tel Aviv Bakery", upload 3 context files in
     Hebrew describing the bakery (hours, menu, location, prices).
   - In settings, copy the widget snippet.
   - In `channels/whatsapp`, paste credentials from a Meta test WABA,
     register the webhook URL in Meta dashboard, confirm "active" status.
3. As a customer:
   - Send a real WhatsApp message asking about menu prices. Confirm the bot
     answers from the uploaded files in Hebrew.
   - Ask the bot to "save me as interested in catering" — confirm a Lead row
     appears in `/leads`.
   - Ask "I want to speak to a human" — confirm escalation, conversation
     moves to Human tab in the inbox.
4. As the business owner:
   - Open the inbox, take over the escalated conversation, send a reply,
     watch it land on WhatsApp.
   - Return to bot, watch the bot resume.
5. Repeat steps 3-4 using the embedded widget on a test HTML page.
6. As a `global_admin` (manually promote a user via SQL):
   - Upload a hidden file. Verify business owner doesn't see it in the UI
     but the bot still uses it in answers.

Document every bug found in `SMOKE_TEST_FINDINGS.md` with severity. Fix
P0/P1 in-session, file P2/P3 as follow-up tasks.

Then write a short `DEMO.md` explaining how to reproduce the end-to-end
demo for a stakeholder.

This closes out Phase 1. Don't start Phase 2 (calendar/CRM/quotes/orders/IG/
voice/customer-memory) in this session.
