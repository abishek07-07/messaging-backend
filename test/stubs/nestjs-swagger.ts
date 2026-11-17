/**
 * Minimal stand-in for `@nestjs/swagger` used by Jest.
 *
 * The real package is ESM-only and its bundled Swagger UI uses `import.meta`,
 * which Jest cannot load while transforming to CommonJS. The decorators only
 * attach OpenAPI metadata and have no effect on behavior, so tests can use
 * no-ops.
 */

type NoopDecorator = (...args: unknown[]) => (...args: unknown[]) => void;

const noop: NoopDecorator = () => () => undefined;

export const ApiProperty = noop;
export const ApiPropertyOptional = noop;

export const ApiOperation = noop;
export const ApiBearerAuth = noop;
export const ApiBadRequestResponse = noop;
export const ApiUnauthorizedResponse = noop;
export const ApiNotFoundResponse = noop;
export const ApiConflictResponse = noop;
export const ApiUnprocessableEntityResponse = noop;
export const ApiInternalServerErrorResponse = noop;

/** Chainable builder; only used by `setupSwagger`, never in tests. */
export class DocumentBuilder {
  setTitle(_title: string): this {
    return this;
  }

  setDescription(_description: string): this {
    return this;
  }

  setVersion(_version: string): this {
    return this;
  }

  addBearerAuth(..._args: unknown[]): this {
    return this;
  }

  addTag(..._args: unknown[]): this {
    return this;
  }

  build(): Record<string, unknown> {
    return {};
  }
}

export const SwaggerModule = {
  createDocument: (..._args: unknown[]): Record<string, unknown> => ({}),
  setup: (..._args: unknown[]): void => undefined,
};

export type SwaggerCustomOptions = Record<string, unknown>;
