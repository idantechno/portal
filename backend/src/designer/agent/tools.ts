import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { DesignProduct } from '../design-product.entity';
import { DesignerService } from '../designer.service';

export interface ToolContext {
  businessId: string;
  designer: DesignerService;
  /** Mutable — the chat endpoint reads it after the run to tell the UI what was made. */
  created: DesignProduct[];
}

export function listDesignsTool(ctx: ToolContext) {
  return tool(
    'list_designs',
    'Returns the design products already created for this business (id, kind, title).',
    {},
    async () => {
      const rows = await ctx.designer.list(ctx.businessId);
      const payload = rows.map((d) => ({
        id: d.id,
        kind: d.kind,
        title: d.title,
      }));
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
      };
    },
  );
}

export function generateDesignTool(ctx: ToolContext) {
  return tool(
    'generate_design',
    'Creates a print-ready design product from HTML you authored, and renders it to a PDF. Use once you have the kind, content, and brand color.',
    {
      kind: z
        .enum(['menu', 'poster', 'invitation', 'pricelist', 'flyer', 'other'])
        .describe('The type of product.'),
      title: z
        .string()
        .min(1)
        .describe('Short title for the product (Hebrew).'),
      html: z
        .string()
        .min(1)
        .describe(
          'The complete, self-contained HTML document you authored (doctype through </html>), RTL Hebrew, inline <style> only.',
        ),
      content_summary: z
        .string()
        .optional()
        .describe(
          'Plain-text description of the real content (e.g. the dishes and prices).',
        ),
      primary_color: z
        .string()
        .optional()
        .describe("The brand's main color as a hex, e.g. #C0392B."),
    },
    async (args) => {
      const remaining = await ctx.designer.remainingThisMonth(ctx.businessId);
      if (remaining <= 0) {
        return {
          content: [
            {
              type: 'text',
              text: "This business has reached this month's design limit. Do NOT create the product — tell the owner in Hebrew they've hit the monthly limit.",
            },
          ],
        };
      }

      const design = await ctx.designer.create({
        businessId: ctx.businessId,
        kind: args.kind,
        title: args.title,
        html: args.html,
        contentSummary: args.content_summary ?? null,
        primaryColor: args.primary_color ?? null,
      });
      ctx.created.push(design);

      const pdfUrl = `/api/businesses/${ctx.businessId}/designs/${design.id}/pdf`;
      return {
        content: [
          {
            type: 'text',
            text: `Design created (id=${design.id}). PDF: ${pdfUrl}. Reply briefly in Hebrew and tell the owner the PDF is ready.`,
          },
        ],
      };
    },
  );
}
