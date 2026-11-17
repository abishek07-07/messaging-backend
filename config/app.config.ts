import { registerAs } from '@nestjs/config';

/** Token used to inject the app config: `@Inject(appConfig.KEY)`. */
export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  isProduction: process.env.NODE_ENV === 'production',
}));
