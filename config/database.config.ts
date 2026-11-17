import { registerAs } from '@nestjs/config';

/** Token used to inject the database config: `@Inject(databaseConfig.KEY)`. */
export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  name: process.env.DB_NAME ?? 'messaging',
  poolMin: parseInt(process.env.DB_POOL_MIN ?? '0', 10),
  poolMax: parseInt(process.env.DB_POOL_MAX ?? '10', 10),
}));
