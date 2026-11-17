import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { applyDecorators } from '@nestjs/common';
import type { AppError } from '../errors';

/** The security scheme name registered by {@link setupSwagger}. */
export const BEARER_AUTH = 'access-token';

/** Shape of an error body returned by the app (mirrors `AppError`). */
type ErrorBody = Pick<AppError, 'message' | 'statusCode' | 'error'>;

/** Reusable error-response schema/example for the OpenAPI document. */
function errorBody(
  description: string,
  statusCode: string,
): { description: string; schema: { example: ErrorBody } } {
  return {
    description,
    schema: {
      example: {
        message: description,
        statusCode,
        error: description,
      },
    },
  };
}

/**
 * Documents a route with its summary, the standard error responses, and bearer
 * auth. Use one call per endpoint instead of stacking many `@Api*` decorators.
 *
 * ```ts
 * @Post('register')
 * @ApiEndpoint('Register a new user', { auth: false })
 * register(@Body() body: RegisterRequestDto) { … }
 * ```
 */
export function ApiEndpoint(
  summary: string,
  options: { auth?: boolean; description?: string } = {},
): MethodDecorator {
  const decorators: MethodDecorator[] = [
    ApiOperation({ summary, description: options.description }),
    ApiBadRequestResponse(errorBody('Bad Request', 'BAD_REQUEST')),
    ApiUnauthorizedResponse(errorBody('Unauthorized', 'UNAUTHORIZED')),
    ApiNotFoundResponse(errorBody('Not Found', 'NOT_FOUND')),
    ApiConflictResponse(errorBody('Conflict', 'CONFLICT')),
    ApiUnprocessableEntityResponse(
      errorBody('Unprocessable Entity', 'UNPROCESSABLE_ENTITY'),
    ),
    ApiInternalServerErrorResponse(
      errorBody('Internal Server Error', 'INTERNAL_SERVER_ERROR'),
    ),
  ];

  if (options.auth !== false) {
    decorators.push(ApiBearerAuth(BEARER_AUTH));
  }

  return applyDecorators(...decorators);
}
