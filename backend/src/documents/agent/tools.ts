import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { DeliveryMode } from '../../common/enums/delivery-mode.enum';
import { DocumentInstance } from '../document-instance.entity';
import { DocumentsService } from '../documents.service';

export interface ToolContext {
  businessId: string;
  publicSignBaseUrl: string;
  documents: DocumentsService;
  /** Mutable collection — the chat endpoint reads it after the run to tell the UI what was produced. */
  created: DocumentInstance[];
}

export function listAvailableTemplatesTool(ctx: ToolContext) {
  return tool(
    'list_available_templates',
    'Returns the list of document templates this business has access to, including each template key, Hebrew name, delivery mode, and full variable_schema with Hebrew field descriptions.',
    {},
    async () => {
      const rows = await ctx.documents.listAvailableTemplates(ctx.businessId);
      const payload = rows.map((row) => ({
        key: row.template.key,
        name_he: row.template.nameHe,
        delivery_mode: row.template.deliveryMode,
        variable_schema: row.template.variableSchema,
      }));
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    },
  );
}

export function prepareDocumentTool(ctx: ToolContext) {
  return tool(
    'prepare_document',
    'Creates a new document instance from a template with the given variables. Use this once you have collected every required variable from the user. Returns the created document — for client_sign templates, includes the public sign URL to send to the client; for owner_send templates, includes the PDF download URL the business owner can use.',
    {
      template_key: z
        .string()
        .describe(
          "The template key, e.g. 'work_order'. Must match a template returned by list_available_templates.",
        ),
      variables: z
        .record(z.string(), z.unknown())
        .describe(
          'Object whose keys match the template variable_schema. Only include fields the user actually provided.',
        ),
    },
    async (args) => {
      const instance = await ctx.documents.createInstance({
        businessId: ctx.businessId,
        templateKey: args.template_key,
        variables: args.variables,
      });
      ctx.created.push(instance);

      const isSign = instance.publicToken !== null;
      const publicUrl = isSign
        ? `${ctx.publicSignBaseUrl}/sign/${instance.publicToken}`
        : null;
      const pdfDownloadUrl = !isSign
        ? `/api/businesses/${ctx.businessId}/documents/${instance.id}/pdf`
        : null;

      const summary = {
        id: instance.id,
        status: instance.status,
        delivery_mode: isSign
          ? DeliveryMode.ClientSign
          : DeliveryMode.OwnerSend,
        public_url: publicUrl,
        pdf_download_url: pdfDownloadUrl,
      };

      return {
        content: [
          {
            type: 'text',
            text: `Document created. Reply to the business owner now in Hebrew with this URL.\n\n${JSON.stringify(summary, null, 2)}`,
          },
        ],
      };
    },
  );
}
