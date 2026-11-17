import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import type { Knex } from 'knex';
import { LoggingService } from '../logging/logging.service';
import { KNEX_CONNECTION } from './database.constants';

/**
 * Thin wrapper around the shared Knex connection.
 *
 * Repositories inject the connection token directly; this service provides
 * lifecycle behavior: a connectivity `ping()` and closing the pool on shutdown
 * (via `app.enableShutdownHooks()` in `main.ts`).
 */
@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly logger: LoggingService;

  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    logger: LoggingService,
  ) {
    this.logger = logger.withContext(DatabaseService.name);
  }

  /**
   * Verify the database is reachable. Returns `true` on success; logs and
   * returns `false` otherwise (boot is not blocked by a transient outage).
   */
  async ping(): Promise<boolean> {
    try {
      await this.knex.raw('select 1');
      return true;
    } catch (error) {
      this.logger.error(
        'Database connection failed',
        error instanceof Error ? error : new Error(String(error)),
      );
      return false;
    }
  }

  /** Close the pool so no connections leak on shutdown. */
  async onApplicationShutdown(): Promise<void> {
    await this.knex.destroy();
    this.logger.log('Database connection pool closed');
  }
}
