import { registerAs } from '@nestjs/config';

/** Token used to inject the logging config: `@Inject(loggingConfig.KEY)`. */
export const loggingConfig = registerAs('logging', () => ({
  /** Directory that holds the log files. */
  dir: process.env.LOG_DIR ?? 'logs',
  /** Minimum level written to the console. */
  level: process.env.LOG_LEVEL ?? 'debug',
  /** Minimum level written to `combined.log`. */
  fileLevel: process.env.LOG_FILE_LEVEL ?? 'debug',
  /** Minimum level written to `error.log`. */
  errorLevel: process.env.LOG_ERROR_LEVEL ?? 'error',
  /** Log full request data (method, url, body…) for every request. */
  logRequests: (process.env.LOG_REQUESTS ?? 'true') === 'true',
}));
