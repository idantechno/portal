import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const HIDDEN_PREFIX = '_hidden/';

/**
 * Owns the per-business workspace directory. All FS access for context files
 * goes through here so we have one place to enforce path-traversal safety.
 *
 * Layout:
 *   {BUSINESSES_DIR}/
 *     {businessId}/                 ← agent's CWD
 *       business.md, ...
 *       _hidden/                    ← global_admin uploads only
 *         internal-notes.md, ...
 */
@Injectable()
export class FilesystemService {
  private readonly root: string;

  constructor(config: ConfigService) {
    const root = config.get<string>('BUSINESSES_DIR');
    if (!root) {
      throw new Error('BUSINESSES_DIR is not configured');
    }
    this.root = path.resolve(root);
  }

  businessRoot(businessId: string): string {
    return path.join(this.root, businessId);
  }

  /**
   * Resolves a user-supplied relative path against a business root, enforcing
   * that the result stays inside that root. Returns the absolute path.
   */
  resolveSafe(businessId: string, relativePath: string): string {
    if (relativePath == null || relativePath.length > 512) {
      throw new BadRequestException('Invalid path');
    }
    const normalized = path
      .normalize(relativePath)
      .replace(/^[/\\]+/, '');
    if (normalized.startsWith('..') || normalized.includes('\0')) {
      throw new BadRequestException('Invalid path');
    }
    const businessRoot = this.businessRoot(businessId);
    const absolute = path.resolve(businessRoot, normalized);
    if (
      absolute !== businessRoot &&
      !absolute.startsWith(businessRoot + path.sep)
    ) {
      throw new BadRequestException('Path escapes business root');
    }
    return absolute;
  }

  /**
   * Normalizes a folder-style relative path (no filename). Returns "" for root.
   * Validates against traversal, length, and the `_hidden/` reservation.
   */
  normalizeFolderPath(folderPath: string, hidden: boolean): string {
    if (folderPath == null) return '';
    const cleaned = folderPath
      .replace(/^[/\\]+/, '')
      .replace(/[/\\]+$/, '')
      .replace(/\\/g, '/')
      .trim();
    if (!cleaned) return '';
    if (cleaned.includes('..') || cleaned.includes('\0')) {
      throw new BadRequestException('Invalid path');
    }
    if (cleaned.length > 480) {
      throw new BadRequestException('Path too long');
    }
    const isHiddenPath =
      cleaned === '_hidden' || cleaned.startsWith(HIDDEN_PREFIX);
    if (isHiddenPath && !hidden) {
      throw new BadRequestException(
        'Path "_hidden/" prefix is reserved for hidden files',
      );
    }
    return cleaned;
  }

  composeRelativePath(userPath: string, hidden: boolean): string {
    const cleaned = userPath
      .replace(/^[/\\]+/, '')
      .replace(/\\/g, '/')
      .trim();
    if (!cleaned) throw new BadRequestException('Empty filename');
    if (cleaned.includes('..') || cleaned.includes('\0')) {
      throw new BadRequestException('Invalid path');
    }
    if (cleaned.length > 480) {
      throw new BadRequestException('Path too long');
    }
    const startsWithHidden =
      cleaned === '_hidden' || cleaned.startsWith(HIDDEN_PREFIX);
    if (startsWithHidden && !hidden) {
      throw new BadRequestException(
        'Path "_hidden/" prefix is reserved for hidden files',
      );
    }
    return hidden && !startsWithHidden ? HIDDEN_PREFIX + cleaned : cleaned;
  }

  /**
   * Joins a folder path and a filename safely. Either may be empty.
   */
  joinFolderAndName(folder: string, filename: string): string {
    const cleanedName = filename
      .replace(/^[/\\]+/, '')
      .replace(/[/\\]+$/, '')
      .replace(/\\/g, '/')
      .trim();
    if (!cleanedName) throw new BadRequestException('Empty filename');
    if (cleanedName.includes('/')) {
      throw new BadRequestException('Filename must not contain path separators');
    }
    return folder ? `${folder}/${cleanedName}` : cleanedName;
  }

  isHiddenPath(relativePath: string): boolean {
    return (
      relativePath === '_hidden' || relativePath.startsWith(HIDDEN_PREFIX)
    );
  }

  async ensureBusinessRoot(businessId: string): Promise<void> {
    const dir = this.businessRoot(businessId);
    await fs.mkdir(dir, { recursive: true });
  }

  async writeFile(
    businessId: string,
    relativePath: string,
    content: Buffer,
  ): Promise<void> {
    const absolute = this.resolveSafe(businessId, relativePath);
    try {
      await fs.mkdir(path.dirname(absolute), { recursive: true });
      await fs.writeFile(absolute, content);
    } catch (err) {
      throw new InternalServerErrorException(
        `Failed to write file: ${(err as Error).message}`,
      );
    }
  }

  async readFile(businessId: string, relativePath: string): Promise<Buffer> {
    const absolute = this.resolveSafe(businessId, relativePath);
    return fs.readFile(absolute);
  }

  async deleteFile(businessId: string, relativePath: string): Promise<void> {
    const absolute = this.resolveSafe(businessId, relativePath);
    try {
      await fs.unlink(absolute);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  async mkdir(businessId: string, relativePath: string): Promise<void> {
    const absolute = this.resolveSafe(businessId, relativePath);
    await fs.mkdir(absolute, { recursive: true });
  }

  async rename(
    businessId: string,
    fromRelative: string,
    toRelative: string,
  ): Promise<void> {
    const fromAbs = this.resolveSafe(businessId, fromRelative);
    const toAbs = this.resolveSafe(businessId, toRelative);
    await fs.mkdir(path.dirname(toAbs), { recursive: true });
    await fs.rename(fromAbs, toAbs);
  }

  async exists(businessId: string, relativePath: string): Promise<boolean> {
    try {
      const absolute = this.resolveSafe(businessId, relativePath);
      await fs.access(absolute);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Recursively lists all directory paths under the business root (excluding
   * the root itself). Returns relative paths with forward slashes.
   */
  async listDirs(businessId: string): Promise<string[]> {
    const root = this.businessRoot(businessId);
    const out: string[] = [];
    async function walk(absDir: string, relDir: string): Promise<void> {
      let entries: import('node:fs').Dirent[];
      try {
        entries = await fs.readdir(absDir, { withFileTypes: true });
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw err;
      }
      for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        const childRel = relDir ? `${relDir}/${ent.name}` : ent.name;
        out.push(childRel);
        await walk(path.join(absDir, ent.name), childRel);
      }
    }
    await walk(root, '');
    return out;
  }
}
