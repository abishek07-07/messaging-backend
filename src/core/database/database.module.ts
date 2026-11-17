import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KNEX_CONNECTION } from './database.constants';
import { createKnex } from './database.factory';
import { DatabaseService } from './database.service';

/**
 * Global database access, powered by Knex + PostgreSQL.
 *
 * Provides the shared `KNEX_CONNECTION` (a Knex client configured from the
 * typed `database` config namespace) and {@link DatabaseService} app-wide, so
 * repositories can inject the connection without importing this module.
 *
 * Register **once** in `AppModule`.
 */
@Global()
@Module({
  providers: [
    {
      provide: KNEX_CONNECTION,
      inject: [ConfigService],
      useFactory: createKnex,
    },
    DatabaseService,
  ],
  exports: [KNEX_CONNECTION, DatabaseService],
})
export class DatabaseModule {}
