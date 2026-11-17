import { HttpException } from '@nestjs/common';
import type { AppError } from '@utils/errors/index';

/**
 * Maps a machine-readable `statusCode` to an HTTP status. Extend this map as
 * new domain codes are introduced; unknown codes default to `400`.
 */
const HTTP_STATUS_BY_CODE: Record<string, number> = {
  VALIDATION_ERROR: 400,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  USER_NOT_FOUND: 404,
  CONFLICT: 409,
  EMAIL_ALREADY_EXISTS: 409,
  USERNAME_ALREADY_EXISTS: 409,
  CANNOT_FRIEND_SELF: 400,
  CANNOT_BLOCK_SELF: 400,
  FRIEND_REQUEST_NOT_FOUND: 404,
  FRIEND_REQUEST_ALREADY_EXISTS: 409,
  FRIEND_REQUEST_ALREADY_RECEIVED: 409,
  FRIEND_REQUEST_NOT_PENDING: 409,
  ALREADY_FRIENDS: 409,
  FRIENDSHIP_NOT_FOUND: 404,
  USER_BLOCKED: 403,
  BLOCK_NOT_FOUND: 404,
  CONVERSATION_NOT_FOUND: 404,
  INVALID_CURSOR: 400,
  MESSAGE_NOT_FOUND: 404,
  MESSAGE_DELETED: 409,
  INVALID_REPLY_TARGET: 400,
  CLIENT_MESSAGE_ID_CONFLICT: 409,
  UNSUPPORTED_MESSAGE_TYPE: 400,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
};

/**
 * An `HttpException` that carries an {@link AppError} body.
 *
 * Throw this from controllers/usecases so failures stay in the `AppError`
 * contract without hand-building HTTP responses — {@link HttpExceptionFilter}
 * serialises it to the client:
 *
 * ```ts
 * throw new AppException({
 *   message: 'That email is already registered',
 *   statusCode: 'EMAIL_ALREADY_EXISTS',
 *   error: 'Conflict',
 * });
 * // → 409 { message, statusCode, error }
 * ```
 *
 * Pass an explicit `status` when the code is not in {@link HTTP_STATUS_BY_CODE}.
 */
export class AppException extends HttpException {
  constructor(error: AppError, status?: number) {
    super({ ...error }, status ?? HTTP_STATUS_BY_CODE[error.statusCode] ?? 400);
  }
}
