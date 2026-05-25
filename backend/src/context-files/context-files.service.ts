import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContextFile } from './context-file.entity';
import { FilesystemService } from './filesystem.service';

export interface UploadInput {
  businessId: string;
  uploadedByUserId: string;
  originalName: string;
  folder?: string;
  buffer: Buffer;
  mimeType: string;
  hidden: boolean;
}

export interface CreateFileInput {
  businessId: string;
  uploadedByUserId: string;
  path: string;
  content: string;
  hidden: boolean;
  mimeType?: string;
}

export interface TreeResponse {
  files: ContextFile[];
  folders: string[];
}

@Injectable()
export class ContextFilesService {
  constructor(
    @InjectRepository(ContextFile)
    private readonly files: Repository<ContextFile>,
    private readonly fs: FilesystemService,
  ) {}

  async upload(input: UploadInput): Promise<ContextFile> {
    await this.fs.ensureBusinessRoot(input.businessId);
    const folder = this.fs.normalizeFolderPath(
      input.folder ?? '',
      input.hidden,
    );
    const filename = input.originalName;
    const userRelative = this.fs.joinFolderAndName(folder, filename);
    const relativePath = this.fs.composeRelativePath(
      userRelative,
      input.hidden,
    );

    const existing = await this.files.findOne({
      where: { businessId: input.businessId, relativePath },
    });
    if (existing) {
      throw new ConflictException(`File already exists: ${relativePath}`);
    }

    await this.fs.writeFile(input.businessId, relativePath, input.buffer);

    const row = this.files.create({
      businessId: input.businessId,
      relativePath,
      mimeType: input.mimeType || 'application/octet-stream',
      size: String(input.buffer.length),
      hiddenForBusiness: input.hidden,
      uploadedByUserId: input.uploadedByUserId,
    });
    return this.files.save(row);
  }

  async createTextFile(input: CreateFileInput): Promise<ContextFile> {
    await this.fs.ensureBusinessRoot(input.businessId);
    const relativePath = this.fs.composeRelativePath(input.path, input.hidden);

    const existing = await this.files.findOne({
      where: { businessId: input.businessId, relativePath },
    });
    if (existing) {
      throw new ConflictException(`File already exists: ${relativePath}`);
    }

    const buffer = Buffer.from(input.content, 'utf-8');
    await this.fs.writeFile(input.businessId, relativePath, buffer);

    const row = this.files.create({
      businessId: input.businessId,
      relativePath,
      mimeType: input.mimeType || guessMime(relativePath),
      size: String(buffer.length),
      hiddenForBusiness: input.hidden,
      uploadedByUserId: input.uploadedByUserId,
    });
    return this.files.save(row);
  }

  async createFolder(
    businessId: string,
    folderPath: string,
    hidden: boolean,
  ): Promise<{ path: string; hidden: boolean }> {
    await this.fs.ensureBusinessRoot(businessId);
    const cleaned = this.fs.normalizeFolderPath(folderPath, hidden);
    if (!cleaned) throw new BadRequestException('Folder path required');
    const target =
      hidden && !cleaned.startsWith('_hidden/') && cleaned !== '_hidden'
        ? `_hidden/${cleaned}`
        : cleaned;
    await this.fs.mkdir(businessId, target);
    return { path: target, hidden: this.fs.isHiddenPath(target) };
  }

  list(businessId: string, includeHidden: boolean): Promise<ContextFile[]> {
    const where = includeHidden
      ? { businessId }
      : { businessId, hiddenForBusiness: false };
    return this.files.find({ where, order: { createdAt: 'DESC' } });
  }

  async tree(
    businessId: string,
    includeHidden: boolean,
  ): Promise<TreeResponse> {
    await this.fs.ensureBusinessRoot(businessId);
    const files = await this.list(businessId, includeHidden);
    const allDirs = await this.fs.listDirs(businessId);
    const folders = includeHidden
      ? allDirs
      : allDirs.filter((d) => !this.fs.isHiddenPath(d));
    // Ensure every folder implied by a file path is included (in case the
    // directory doesn't exist on disk for some reason).
    const folderSet = new Set(folders);
    for (const f of files) {
      const parts = f.relativePath.split('/');
      parts.pop();
      let acc = '';
      for (const part of parts) {
        acc = acc ? `${acc}/${part}` : part;
        folderSet.add(acc);
      }
    }
    return {
      files,
      folders: Array.from(folderSet).sort(),
    };
  }

  async getById(businessId: string, fileId: string): Promise<ContextFile> {
    const file = await this.files.findOne({
      where: { id: fileId, businessId },
    });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  async download(
    businessId: string,
    fileId: string,
  ): Promise<{
    file: ContextFile;
    buffer: Buffer;
  }> {
    const file = await this.getById(businessId, fileId);
    const buffer = await this.fs.readFile(businessId, file.relativePath);
    return { file, buffer };
  }

  async getContent(
    businessId: string,
    fileId: string,
  ): Promise<{ file: ContextFile; content: string }> {
    const { file, buffer } = await this.download(businessId, fileId);
    return { file, content: buffer.toString('utf-8') };
  }

  async updateContent(
    businessId: string,
    fileId: string,
    content: string,
  ): Promise<ContextFile> {
    const file = await this.getById(businessId, fileId);
    const buffer = Buffer.from(content, 'utf-8');
    await this.fs.writeFile(businessId, file.relativePath, buffer);
    file.size = String(buffer.length);
    return this.files.save(file);
  }

  async move(
    businessId: string,
    fileId: string,
    newPath: string,
    isGlobalAdmin: boolean,
  ): Promise<ContextFile> {
    const file = await this.getById(businessId, fileId);
    // Hidden flag follows the destination — derive from the path. Only
    // global_admin can place files in `_hidden/` or move them out.
    const destPath = this.fs.composeRelativePath(newPath, true);
    const destIsHidden = this.fs.isHiddenPath(destPath);
    if ((destIsHidden || file.hiddenForBusiness) && !isGlobalAdmin) {
      throw new ForbiddenException(
        'Only global admins can move files into or out of the hidden area',
      );
    }
    if (destPath === file.relativePath) return file;
    const existing = await this.files.findOne({
      where: { businessId, relativePath: destPath },
    });
    if (existing) {
      throw new ConflictException(`File already exists: ${destPath}`);
    }
    await this.fs.rename(businessId, file.relativePath, destPath);
    file.relativePath = destPath;
    file.hiddenForBusiness = destIsHidden;
    return this.files.save(file);
  }

  async remove(businessId: string, fileId: string): Promise<void> {
    const file = await this.getById(businessId, fileId);
    await this.fs.deleteFile(businessId, file.relativePath);
    await this.files.delete({ id: file.id });
  }
}

function guessMime(relativePath: string): string {
  const lower = relativePath.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown'))
    return 'text/markdown';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'text/yaml';
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html';
  if (lower.endsWith('.css')) return 'text/css';
  return 'text/plain';
}
