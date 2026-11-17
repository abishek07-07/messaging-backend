import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { SwaggerCustomOptions } from '@nestjs/swagger';
import type { ConfigService } from '@nestjs/config';

/** Options accepted by {@link setupSwagger}. */
export interface SetupSwaggerOptions {
  /** Mount path for the UI, e.g. `docs` → `/docs`. Defaults to `docs`. */
  path?: string;
  /** Skip setup entirely (typically off in production). */
  enabled?: boolean;
  /** Human-readable API title. */
  title?: string;
  /** API description shown at the top of the docs. */
  description?: string;
  /** API version string. */
  version?: string;
  /** Extra tags to seed the document with. */
  tags?: { name: string; description?: string }[];
  /** Pass-through options for `SwaggerModule.setup`. */
  customOptions?: SwaggerCustomOptions;
}

/**
 * Build and mount the OpenAPI document + Swagger UI for an app.
 *
 * Pass a `ConfigService` to read the `swagger` namespace (path, enabled, title…)
 * with the options above acting as fallbacks:
 *
 * ```ts
 * const config = app.get(ConfigService);
 * setupSwagger(app, config);
 * // GET /docs        → Swagger UI
 * // GET /docs-json   → OpenAPI JSON
 * // GET /docs-yaml   → OpenAPI YAML
 * ```
 *
 * Returns `false` when swagger is disabled, so callers can log accordingly.
 */
export function setupSwagger(
  app: INestApplication,
  config?: ConfigService,
  options: SetupSwaggerOptions = {},
): boolean {
  const enabled =
    options.enabled ?? config?.get<boolean>('swagger.enabled') ?? true;

  if (!enabled) {
    return false;
  }

  const path = options.path ?? config?.get<string>('swagger.path') ?? 'docs';
  const title = options.title ?? config?.get<string>('swagger.title') ?? 'API';
  const description =
    options.description ?? config?.get<string>('swagger.description') ?? '';
  const version =
    options.version ?? config?.get<string>('swagger.version') ?? '1.0.0';

  const builder = new DocumentBuilder()
    .setTitle(title)
    .setDescription(description)
    .setVersion(version)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
      },
      'access-token',
    );

  for (const tag of options.tags ?? []) {
    builder.addTag(tag.name, tag.description);
  }

  const document = SwaggerModule.createDocument(app, builder.build());

  SwaggerModule.setup(path, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
    jsonDocumentUrl: `${path}-json`,
    yamlDocumentUrl: `${path}-yaml`,
    ...options.customOptions,
  });

  return true;
}

export { ApiEndpoint, BEARER_AUTH } from './decorators';
