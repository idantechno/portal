import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Business } from '../businesses/business.entity';
import { FilesystemService } from '../context-files/filesystem.service';

/**
 * Irreversibly wipes a tenant and everything it owns — the Level-B hard purge.
 *
 * There are no DB-level foreign keys in this schema, so nothing cascades on its
 * own: we delete every business-scoped row explicitly. Rather than hand-list ~27
 * tables (and silently miss any added later), we ask TypeORM which entities
 * actually carry a `business_id` column and clear each one. The whole wipe runs
 * in a single transaction; the filesystem workspace is removed after it commits.
 */
@Injectable()
export class BusinessPurgeService {
  private readonly log = new Logger(BusinessPurgeService.name);

  // audit_events is intentionally retained — it is the operator's compliance
  // trail (who deleted what, when) and holds no end-customer message content.
  private static readonly KEEP_TABLES = new Set(['audit_events']);

  constructor(
    private readonly dataSource: DataSource,
    private readonly filesystem: FilesystemService,
  ) {}

  /**
   * Hard-delete a business and all its data. Safe to call on an
   * already-soft-deleted row (the daily job does). Returns the number of
   * child-table deletes issued, for logging.
   */
  async purge(businessId: string): Promise<void> {
    // Every entity that has a `business_id` column, except the ones we keep.
    const targets = this.dataSource.entityMetadatas.filter(
      (meta) =>
        !BusinessPurgeService.KEEP_TABLES.has(meta.tableName) &&
        meta.columns.some((c) => c.databaseName === 'business_id'),
    );

    await this.dataSource.transaction(async (m) => {
      for (const meta of targets) {
        await m
          .createQueryBuilder()
          .delete()
          .from(meta.target)
          .where('business_id = :businessId', { businessId })
          .execute();
      }
      // Finally the parent row itself. `.delete()` is a hard delete, so it
      // removes the row even though it is soft-deleted (deleted_at set).
      await m.getRepository(Business).delete({ id: businessId });
    });

    // Remove the tenant's on-disk workspace (context/knowledge files). Done
    // after the DB commit; failure here is logged, not fatal — the records are
    // already gone and a stray directory is harmless.
    try {
      await this.filesystem.deleteBusinessDir(businessId);
    } catch (err) {
      this.log.error(
        `Purged tenant ${businessId} from DB but failed to remove its files: ${(err as Error).message}`,
      );
    }

    this.log.log(
      `Hard-purged tenant ${businessId} across ${targets.length} tables.`,
    );
  }
}
