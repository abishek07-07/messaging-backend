import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { appConfig } from './app.config';
import { databaseConfig } from './database.config';
import { hashingConfig } from './hashing.config';
import { jwtConfig } from './jwt.config';
import { loggingConfig } from './logging.config';
import { swaggerConfig } from './swagger.config';
import { validateEnv } from './env.validation';

/**
 * Application configuration.
 *
 * Loads `.env` (with environment-specific overrides) into a **validated**,
 * **typed** configuration, then exposes it through namespaced factories:
 *
 * - `appConfig`      → `appConfig.KEY`      ('app')
 * - `databaseConfig` → `databaseConfig.KEY` ('database')
 * - `hashingConfig`  → `hashingConfig.KEY`  ('hashing')
 * - `jwtConfig`      → `jwtConfig.KEY`      ('jwt')
 * - `loggingConfig`  → `loggingConfig.KEY`  ('logging')
 * - `swaggerConfig`  → `swaggerConfig.KEY`  ('swagger')
 *
 * Register **once** in `AppModule`. `isGlobal: true` means any provider can
 * inject `ConfigService` (or a namespace via `@Inject(xConfig.KEY)`) without
 * importing this module.
 *
 * Environment files are resolved by priority: `.env.<NODE_ENV>` first, then
 * `.env`, so the more specific file wins and falls back to the generic one.
 */
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      load: [
        appConfig,
        databaseConfig,
        hashingConfig,
        jwtConfig,
        loggingConfig,
        swaggerConfig,
      ],
      validate: validateEnv,
    }),
  ],
})
export class ConfigModule {}
