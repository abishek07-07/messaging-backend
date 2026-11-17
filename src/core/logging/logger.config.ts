import { utilities } from 'nest-winston';
import * as winston from 'winston';
import type { WinstonModuleOptions } from 'nest-winston';
import type { ConfigService } from '@nestjs/config';

/** Resolved logging options independent of the config source. */
export interface LoggingOptions {
  dir: string;
  consoleLevel: string;
  fileLevel: string;
  errorLevel: string;
}

const DEFAULTS: LoggingOptions = {
  dir: 'logs',
  consoleLevel: 'debug',
  fileLevel: 'debug',
  errorLevel: 'error',
};

/** Build {@link WinstonModuleOptions} from already-resolved values. */
export function buildLoggerOptions(
  options: Partial<LoggingOptions> = {},
): WinstonModuleOptions {
  const resolved: LoggingOptions = {
    dir: options.dir ?? DEFAULTS.dir,
    consoleLevel: options.consoleLevel ?? DEFAULTS.consoleLevel,
    fileLevel: options.fileLevel ?? DEFAULTS.fileLevel,
    errorLevel: options.errorLevel ?? DEFAULTS.errorLevel,
  };
  const { dir, consoleLevel, fileLevel, errorLevel } = resolved;

  return {
    level: fileLevel,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
    ),
    transports: [
      // Human-readable console output.
      new winston.transports.Console({
        level: consoleLevel,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.ms(),
          utilities.format.nestLike('Messaging', {
            colors: true,
            prettyPrint: true,
          }),
        ),
      }),

      // Everything, as JSON.
      new winston.transports.File({
        level: fileLevel,
        filename: `${dir}/combined.log`,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),

      // Errors only, as JSON.
      new winston.transports.File({
        level: errorLevel,
        filename: `${dir}/error.log`,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
    ],
  };
}

/**
 * Build the Winston options from the typed `logging` config namespace.
 *
 * Used by `LoggingModule` (cloud/preferred path). Never reads `process.env`.
 */
export function createLoggerOptions(
  config: ConfigService,
): WinstonModuleOptions {
  return buildLoggerOptions({
    dir: config.get<string>('logging.dir') ?? DEFAULTS.dir,
    consoleLevel: config.get<string>('logging.level') ?? DEFAULTS.consoleLevel,
    fileLevel: config.get<string>('logging.fileLevel') ?? DEFAULTS.fileLevel,
    errorLevel: config.get<string>('logging.errorLevel') ?? DEFAULTS.errorLevel,
  });
}
