import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  OWNER_COMMANDS_QUEUE,
  OwnerCommandJob,
} from './owner-commands.constants';
import { OwnerConciergeService } from './owner-concierge.service';
import { WhatsappConnectionsService } from '../whatsapp/whatsapp-connections.service';

/** A filename for media that arrived without one (WhatsApp images have none). */
function defaultMediaFilename(mimeType: string, mediaId: string): string {
  const ext =
    {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
    }[mimeType] ?? 'bin';
  return `whatsapp-${mediaId.slice(-8)}.${ext}`;
}

/**
 * Runs owner commands off the queue: text → the concierge agent; media →
 * download the file then file/expense it. The reply (if any) is sent back over
 * WhatsApp from here — the concierge stays free of the WhatsApp dependency.
 */
@Processor(OWNER_COMMANDS_QUEUE)
export class OwnerCommandsProcessor extends WorkerHost {
  private readonly log = new Logger(OwnerCommandsProcessor.name);

  constructor(
    private readonly concierge: OwnerConciergeService,
    private readonly whatsapp: WhatsappConnectionsService,
  ) {
    super();
  }

  async process(job: Job<OwnerCommandJob>): Promise<void> {
    const data = job.data;
    let result: { reply: string } | null = null;

    if (data.type === 'text') {
      result = await this.concierge.handle({
        businessId: data.businessId,
        fromPhone: data.fromPhone,
        wamid: data.wamid,
        body: data.body,
      });
    } else {
      const media = await this.whatsapp.downloadMedia(
        data.businessId,
        data.mediaId,
      );
      if (!media) {
        this.log.warn(
          `Owner media ${data.wamid}: WhatsApp not connected / download empty.`,
        );
        return;
      }
      const mimeType = data.mimeType ?? media.mimeType;
      const fileName =
        data.fileName?.trim() || defaultMediaFilename(mimeType, data.mediaId);
      result = await this.concierge.handleMedia({
        businessId: data.businessId,
        fromPhone: data.fromPhone,
        wamid: data.wamid,
        buffer: media.buffer,
        mimeType,
        fileName,
        caption: data.caption ?? '',
      });
    }

    if (result?.reply) {
      await this.whatsapp.sendText(
        data.businessId,
        data.fromPhone,
        result.reply,
      );
    }
  }
}
