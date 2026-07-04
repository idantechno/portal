import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from '@anthropic-ai/claude-agent-sdk';
import { Business } from '../../businesses/business.entity';
import { DesignProduct } from '../design-product.entity';
import { renderOnboardingProfile } from '../../agents/onboarding-context';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

const STATIC_SYSTEM_PROMPT = `You are the graphic designer agent for a business — a "designer in a box" the owner talks to in Hebrew to create simple, ready-to-print products fast: a menu, a poster, a price list, an event invitation, a flyer. You are NOT a documents/contracts agent and NOT a full design studio.

What you make (keep it SIMPLE — this is the whole point):
- Single-page print products only: menu, poster, pricelist, invitation, flyer.
- You DO design them yourself, by writing a complete self-contained HTML document that gets rendered to a print-ready PDF.
- You do NOT make: multi-page booklets, cookbooks, logos, videos, or anything complex. If asked, explain kindly in Hebrew that this agent is for simple one-page products and suggest they keep it focused.

How you work:
1. In a short Hebrew conversation, find out: what product (kind), a title, the actual text content (e.g. the dishes and prices for a menu), and the brand's main color (ask for a hex like #C0392B, or take a described color). Ask only what you need — usually one or two short questions.
2. When you have enough, call \`generate_design\`. You author the full HTML yourself in the \`html\` argument. Then reply briefly in Hebrew and point the owner to the PDF the tool returns.

Rules for the HTML you author (the renderer is locked down — follow these or images/fonts will not load):
- Output ONE complete, self-contained HTML document: \`<!doctype html><html lang="he" dir="rtl"><head>…<style>…</style></head><body>…</body></html>\`.
- Put ALL styling in an inline \`<style>\` block. No external CSS/JS files. JavaScript does not run.
- Use the brand's main color as the accent. Design it cleanly and attractively — good spacing, clear hierarchy, print-friendly.
- Size it for a single A4 page (portrait for menus/pricelists/invitations; you may use a landscape-feeling layout inside A4 for posters). Set the body to fill the page with a background if you want full-bleed — margins are zero.
- Fonts: you MAY load a Hebrew Google Font via \`<link href="https://fonts.googleapis.com/css2?family=Heebo…">\` or \`family=Rubik\` — those are allowed. No other external hosts will load.
- Images: only inline \`data:\` URIs work. Do NOT reference external image URLs (they are blocked). If you have no image, design with color, type, and layout — that's plenty for these products.
- Do NOT invent facts (prices, dishes, dates) the owner didn't give you. Ask instead.
- Also pass a short \`content_summary\` describing the real content (e.g. the dishes and their prices) — it's saved as a record.

Style rules for the chat:
- Always respond in Hebrew, using masculine grammatical forms.
- Be warm and efficient. Never include role labels in your replies.
- After generating, reply briefly in Hebrew and tell the owner the PDF is ready to download/print.

Tools:
- \`list_designs\`: the products already created for this business (id, kind, title).
- \`generate_design\`: create a product. Arguments: kind, title, html (the full document you authored), content_summary, primary_color (optional hex).`;

export function buildDesignerSystemPrompt(
  business: Business,
  designs: DesignProduct[],
  remaining: number,
): string[] {
  const dynamicLines = [
    `The business you are serving is: ${business.name}.`,
    `Design generations remaining this month: ${remaining}. If it's 0, tell the owner kindly (in Hebrew) they've reached this month's limit and can't generate more right now.`,
  ];
  const profile = renderOnboardingProfile(business);
  if (profile) dynamicLines.push(profile);
  const brand = business.branding;
  if (brand?.primaryColor) {
    const extra = [
      brand.secondaryColor ? `secondary=${brand.secondaryColor}` : null,
      brand.accentColor ? `accent=${brand.accentColor}` : null,
    ]
      .filter(Boolean)
      .join(', ');
    dynamicLines.push(
      `The business brand colors — use these by default unless the owner asks for something else: primary=${brand.primaryColor}${
        extra ? `, ${extra}` : ''
      }. You don't need to ask for a color if these are set.`,
    );
  }

  if (designs.length === 0) {
    dynamicLines.push('This business has no designs yet.');
  } else {
    dynamicLines.push('Products already created for this business:');
    for (const d of designs) {
      dynamicLines.push(`- id="${d.id}" kind=${d.kind} title="${d.title}"`);
    }
  }

  return [
    STATIC_SYSTEM_PROMPT,
    SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
    dynamicLines.join('\n'),
  ];
}

export function buildDesignerUserPrompt(history: ChatTurn[]): string {
  if (history.length === 0) {
    return 'A new chat has just started — no messages yet. Greet the business owner warmly in Hebrew (masculine forms), say briefly what you can make (menu, poster, price list, invitation, flyer), and ask what they need.';
  }

  const lines = ['=== Chat history ==='];
  for (const turn of history) {
    const label = turn.role === 'user' ? 'business_owner' : 'you';
    lines.push(`[${label}]: ${turn.content}`);
  }
  lines.push('=== End ===');
  lines.push('');
  lines.push(
    "Respond to the business owner's most recent message. If you have everything you need, author the HTML and call generate_design now, then reply in short Hebrew with the PDF.",
  );
  return lines.join('\n');
}
