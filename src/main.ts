import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { config as loadEnv } from 'dotenv';
import { WinstonModule } from 'nest-winston';
import { AppModule } from './app.module';
import { AllExceptionsFilter, HttpExceptionFilter } from '@core/filters/index';
import { buildLoggerOptions } from '@core/logging/logger.config';
import { LoggingService } from '@core/logging/logging.service';
import { AppValidationPipe } from '@core/pipes/index';
import { setupSwagger } from '@utils/swagger/index';

/**
 * Load environment variables from a file before anything else runs.
 *
 * Priority: `.env.<NODE_ENV>` first (defaults to `development`), falling back to
 * `.env`. Values already present in the process environment win, so real
 * deployment secrets are never overridden by a committed file.
 *
 * This runs *before* Nest boots so `process.env.NODE_ENV`/`PORT` are available
 * to `ConfigModule` when it resolves its own env files.
 */
function bootstrapEnv(): void {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  loadEnv({ path: [`.env.${nodeEnv}`, '.env'] });
}

async function bootstrap() {
  bootstrapEnv();

  // Build the Winston logger before Nest boots so *every* framework log
  // (including startup) goes through Winston. Config is already in process.env.
  const logger = WinstonModule.createLogger(
    buildLoggerOptions({
      dir: process.env.LOG_DIR,
      consoleLevel: process.env.LOG_LEVEL,
      fileLevel: process.env.LOG_FILE_LEVEL,
      errorLevel: process.env.LOG_ERROR_LEVEL,
    }),
  );

  const app = await NestFactory.create(AppModule, { logger });
  const config = app.get(ConfigService);

  // Strip unknown fields, fail fast on the first error, and return a
  // frontend-friendly error body.
  app.useGlobalPipes(new AppValidationPipe());

  // One consistent AppError shape for every failure. Nest checks filters in
  // reverse registration order, so the catch-all is registered first and
  // `HttpExceptionFilter` (specific match) wins for HTTP exceptions.
  const loggingService = app.get(LoggingService);
  app.useGlobalFilters(
    new AllExceptionsFilter(loggingService),
    new HttpExceptionFilter(loggingService),
  );

  // Let providers close resources (e.g. the database pool) on shutdown.
  app.enableShutdownHooks();

  setupSwagger(app, config);

  const port = config.get<number>('app.port') ?? 3000;
  await app.listen(port);

  logger.log(`Application is running on http://localhost:${port}`, 'Bootstrap');
}
void bootstrap();
