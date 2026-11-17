import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export enum LogLevel {
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
  Debug = 'debug',
  Verbose = 'verbose',
}

/**
 * Schema for every environment variable the app reads.
 *
 * `class-validator` decorators describe the shape; {@link validateEnv} uses
 * them to reject a bad environment at boot rather than deep inside a request.
 * Add a new property here whenever a new env var is introduced.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  PORT: number = 3000;

  /** Secret used to sign and verify JWTs. */
  @IsString()
  @MinLength(16, { message: 'JWT_SECRET must be at least 16 characters' })
  @IsOptional()
  JWT_SECRET: string = 'development-secret-change-me';

  /** Lifetime of an issued access token, e.g. `15m`, `1h`, `7d`. */
  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = '15m';

  /** bcrypt cost factor used when hashing passwords. */
  @IsInt()
  @Min(4)
  @Max(15)
  @IsOptional()
  HASH_ROUNDS: number = 10;

  /** Whether the Swagger UI is served. */
  @IsBoolean()
  @IsOptional()
  SWAGGER_ENABLED: boolean = false;

  /** Mount path for the Swagger UI. */
  @IsString()
  @IsOptional()
  SWAGGER_PATH: string = 'docs';

  /** Directory that holds the log files. */
  @IsString()
  @IsOptional()
  LOG_DIR: string = 'logs';

  /** Minimum level written to the console. */
  @IsEnum(LogLevel)
  @IsOptional()
  LOG_LEVEL: LogLevel = LogLevel.Debug;

  /** Whether full request data is logged (development). */
  @IsBoolean()
  @IsOptional()
  LOG_REQUESTS: boolean = true;

  /** PostgreSQL host. */
  @IsString()
  @IsOptional()
  DB_HOST: string = 'localhost';

  /** PostgreSQL port. */
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  DB_PORT: number = 5432;

  /** PostgreSQL user. */
  @IsString()
  @IsOptional()
  DB_USER: string = 'postgres';

  /** PostgreSQL password. */
  @IsString()
  @IsOptional()
  DB_PASSWORD: string = '';

  /** PostgreSQL database name. */
  @IsString()
  @IsOptional()
  DB_NAME: string = 'messaging';

  /** Minimum connections kept in the pool. */
  @IsInt()
  @Min(0)
  @IsOptional()
  DB_POOL_MIN: number = 0;

  /** Maximum connections in the pool. */
  @IsInt()
  @Min(1)
  @IsOptional()
  DB_POOL_MAX: number = 10;
}

/**
 * Validate `raw` (normally `process.env`) against {@link EnvironmentVariables}.
 *
 * Passed to `ConfigModule.forRoot({ validate })`. Throws with a readable message
 * if any variable is missing or malformed, so a misconfigured app fails fast.
 */
export function validateEnv(
  raw: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, raw, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('\n  - ');
    throw new Error(`Invalid environment configuration:\n  - ${details}`);
  }

  return validated;
}
