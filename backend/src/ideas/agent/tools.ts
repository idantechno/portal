import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { IdeaStatus } from '../../common/enums/idea-status.enum';
import { Idea } from '../idea.entity';
import { IdeasService } from '../ideas.service';

export interface ToolContext {
  businessId: string;
  ideas: IdeasService;
  /** Mutable — the chat endpoint reads it after the run to tell the UI what changed. */
  saved: Idea[];
}

function record(ctx: ToolContext, idea: Idea): void {
  const i = ctx.saved.findIndex((s) => s.id === idea.id);
  if (i >= 0) ctx.saved[i] = idea;
  else ctx.saved.push(idea);
}

export function listIdeasTool(ctx: ToolContext) {
  return tool(
    'list_ideas',
    'Returns the ideas already saved for this business (id, title, summary, status). Use it to find the id of an existing idea the owner refers to.',
    {},
    async () => {
      const rows = await ctx.ideas.list(ctx.businessId);
      const payload = rows.map((idea) => ({
        id: idea.id,
        title: idea.title,
        summary: idea.summary,
        status: idea.status,
      }));
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
      };
    },
  );
}

export function saveIdeaTool(ctx: ToolContext) {
  return tool(
    'save_idea',
    'Creates a new idea. Use when the owner shares a fresh idea or thought. Give it a clear title and a polished one-line summary. Returns the created idea id.',
    {
      title: z
        .string()
        .min(1)
        .describe('Short, clear title for the idea (Hebrew).'),
      summary: z
        .string()
        .optional()
        .describe('A polished one-line restatement of the raw idea (Hebrew).'),
      body: z
        .string()
        .optional()
        .describe(
          'Optional developed content: directions, next steps (Hebrew markdown).',
        ),
    },
    async (args) => {
      const idea = await ctx.ideas.create({
        businessId: ctx.businessId,
        title: args.title,
        summary: args.summary ?? null,
        body: args.body ?? '',
        status: args.body ? IdeaStatus.Developed : IdeaStatus.Shaping,
      });
      record(ctx, idea);
      return {
        content: [
          {
            type: 'text',
            text: `Idea saved (id=${idea.id}). Reply briefly in Hebrew and offer a direction to develop it.`,
          },
        ],
      };
    },
  );
}

export function developIdeaTool(ctx: ToolContext) {
  return tool(
    'develop_idea',
    'Updates an existing idea by id — use when the owner builds on or revisits a saved idea. Move status forward as the idea matures (seed → shaping → developed).',
    {
      id: z
        .string()
        .describe('The id of the idea to update (from list_ideas).'),
      title: z
        .string()
        .optional()
        .describe('New title (Hebrew), if it changed.'),
      summary: z
        .string()
        .optional()
        .describe('Updated polished summary (Hebrew).'),
      body: z
        .string()
        .optional()
        .describe(
          'Updated developed content: directions, first move (Hebrew markdown).',
        ),
      status: z
        .nativeEnum(IdeaStatus)
        .optional()
        .describe('New lifecycle status: seed, shaping, or developed.'),
    },
    async (args) => {
      const idea = await ctx.ideas.update(ctx.businessId, args.id, {
        title: args.title,
        summary: args.summary,
        body: args.body,
        status: args.status,
      });
      record(ctx, idea);
      return {
        content: [
          {
            type: 'text',
            text: `Idea updated (id=${idea.id}, status=${idea.status}). Reply briefly in Hebrew.`,
          },
        ],
      };
    },
  );
}
