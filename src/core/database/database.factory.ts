import knex from 'knex';
import type { Knex } from 'knex';
import type { ConfigService } from '@nestjs/config';

/**
 * Build a Knex client (PostgreSQL) from the typed `database` config namespace.
 *
 * The connection is **lazy**: Knex opens the first connection on the first
 * query, so the app can boot while the database is momentarily unavailable.
 * The pool is closed on shutdown by {@link DatabaseService}.
 */
export function createKnex(config: ConfigService): Knex {
  return knex({
    client: 'pg',
    connection: {
      host: config.get<string>('database.host'),
      port: config.get<number>('database.port'),
      user: config.get<string>('database.user'),
      password: config.get<string>('database.password'),
      database: config.get<string>('database.name'),
    },
    pool: {
      min: config.get<number>('database.poolMin') ?? 0,
      max: config.get<number>('database.poolMax') ?? 10,
    },
  });
}
