import 'reflect-metadata';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

/**
 * Standalone DataSource for the TypeORM CLI (migration generate/run/revert).
 * The running app configures TypeORM via app.module (forRootAsync); this file
 * mirrors that connection so migrations target the same schema. Reads the same
 * env vars — run it where they're set (e.g. inside the backend container).
 */
const sslEnabled = process.env.DB_SSL === 'true';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'portal',
  // Mirror app.module's TLS handling so CLI migrations reach a prod DB that
  // requires SSL. See app.module.ts for the DB_SSL / reject-unauthorized notes.
  ssl: sslEnabled
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' }
    : false,
  entities: [join(__dirname, '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
});
