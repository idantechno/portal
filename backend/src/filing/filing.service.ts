import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FilesystemService } from '../context-files/filesystem.service';
import { FiledDocument, FiledDocumentSource } from './filed-document.entity';

/** Suggested folders offered by default in the documents drawer. */
export const DEFAULT_FOLDERS = [
  'כללי',
  'ביטוח לאומי',
  'חשבונות שוטפים',
  'מס הכנסה',
];

/** Folder that documents produced by the documents agent are auto-filed into. */
export const PRODUCED_FOLDER = 'מסמכים שהופקו';

const FILING_ROOT = 'filing';

export interface UploadInput {
  businessId: string;
  folder?: string | null;
  filename: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
  source?: FiledDocumentSource;
  createdByUserId?: string | null;
}

// Fold path separators + parent refs into safe text, preserving spaces and
// non-ASCII (Hebrew). FilesystemService.resolveSafe is the real traversal guard.
function safeFolder(input?: string | null): string {
  const cleaned = (input ?? '')
    .replace(/[/\\]/g, ' ')
    .replace(/\.\./g, '')
    .trim();
  return cleaned.slice(0, 128) || 'כללי';
}

function safeName(input: string): string {
  const cleaned = (input ?? 'file')
    .replace(/[/\\]/g, '_')
    .replace(/\.\./g, '')
    .trim();
  return cleaned.slice(0, 200) || 'file';
}

/**
 * The documents drawer: foldered filing of the business's paperwork, backed by
 * the per-business filesystem workspace. Kept separate from context files.
 */
@Injectable()
export class FilingService {
  constructor(
    @InjectRepository(FiledDocument)
    private readonly docs: Repository<FiledDocument>,
    private readonly filesystem: FilesystemService,
  ) {}

  list(businessId: string): Promise<FiledDocument[]> {
    return this.docs.find({
      where: { businessId },
      order: { folder: 'ASC', createdAt: 'DESC' },
    });
  }

  /** Default folders unioned with any folders that already hold documents. */
  async folders(businessId: string): Promise<string[]> {
    const rows = await this.docs.find({
      where: { businessId },
      select: { folder: true },
    });
    const used = rows.map((r) => r.folder);
    return [...new Set([...DEFAULT_FOLDERS, ...used])];
  }

  async findByIdScoped(businessId: string, id: string): Promise<FiledDocument> {
    const row = await this.docs.findOne({ where: { id, businessId } });
    if (!row) throw new NotFoundException(`Document ${id} not found`);
    return row;
  }

  async upload(input: UploadInput): Promise<FiledDocument> {
    const folder = safeFolder(input.folder);
    const name = safeName(input.filename);
    const storedName = `${randomUUID()}__${name}`;
    const relativePath = `${FILING_ROOT}/${folder}/${storedName}`;
    await this.filesystem.writeFile(
      input.businessId,
      relativePath,
      input.buffer,
    );
    return this.docs.save(
      this.docs.create({
        businessId: input.businessId,
        folder,
        filename: name,
        relativePath,
        mimeType: input.mimeType,
        size: input.size,
        source: input.source ?? 'upload',
        createdByUserId: input.createdByUserId ?? null,
      }),
    );
  }

  /** Files a document produced by the documents agent into the drawer. */
  fileProduced(input: {
    businessId: string;
    filename: string;
    buffer: Buffer;
    mimeType: string;
  }): Promise<FiledDocument> {
    return this.upload({
      businessId: input.businessId,
      folder: PRODUCED_FOLDER,
      filename: input.filename,
      mimeType: input.mimeType,
      size: input.buffer.length,
      buffer: input.buffer,
      source: 'agent',
    });
  }

  async move(
    businessId: string,
    id: string,
    toFolder: string,
  ): Promise<FiledDocument> {
    const row = await this.findByIdScoped(businessId, id);
    const folder = safeFolder(toFolder);
    if (folder === row.folder) return row;
    const storedName = row.relativePath.split('/').pop() ?? row.filename;
    const newPath = `${FILING_ROOT}/${folder}/${storedName}`;
    await this.filesystem.rename(businessId, row.relativePath, newPath);
    row.folder = folder;
    row.relativePath = newPath;
    return this.docs.save(row);
  }

  async download(
    businessId: string,
    id: string,
  ): Promise<{ row: FiledDocument; buffer: Buffer }> {
    const row = await this.findByIdScoped(businessId, id);
    const buffer = await this.filesystem.readFile(businessId, row.relativePath);
    return { row, buffer };
  }

  async remove(businessId: string, id: string): Promise<void> {
    const row = await this.findByIdScoped(businessId, id);
    await this.filesystem.deleteFile(businessId, row.relativePath);
    await this.docs.remove(row);
  }
}
