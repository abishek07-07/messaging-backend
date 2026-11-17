import { registerAs } from '@nestjs/config';

/** Token used to inject the swagger config: `@Inject(swaggerConfig.KEY)`. */
export const swaggerConfig = registerAs('swagger', () => ({
  /** Mount path for the Swagger UI. */
  path: process.env.SWAGGER_PATH ?? 'docs',
  /** Whether the docs are served at all (normally off in production). */
  enabled: (process.env.SWAGGER_ENABLED ?? 'false') === 'true',
  title: process.env.SWAGGER_TITLE ?? 'Messaging API',
  description: process.env.SWAGGER_DESCRIPTION ?? 'Messaging backend API',
  version: process.env.SWAGGER_VERSION ?? '1.0.0',
}));
