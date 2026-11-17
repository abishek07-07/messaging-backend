import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AppError } from '@utils/errors/index';
import { LoggingService } from '../logging/logging.service';

/**
 * Formats every thrown `HttpException` into the {@link AppError} body — the
 * client never receives Nest's default error shapes, and controllers never
 * hand-build error responses; they **throw** (e.g. `AppException`,
 * `NotFoundException`, or a `BadRequestException` from `AppValidationPipe`) and
 * this filter serialises the response.
 *
 * If the exception payload already matches `AppError` it is passed through;
 * otherwise the status label and code are derived from the HTTP status.
 *
 * ```json
 * { "error": "Not Found", "statusCode": "NOT_FOUND", "message": "Cannot GET /nope" }
 * ```
 *
 * Registered globally in `main.ts` **before** {@link AllExceptionsFilter} so
 * HTTP errors are matched here first. Logs 4xx as `warn`, 5xx as `error`.
 */
@Injectable()
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger: LoggingService;

  constructor(logger: LoggingService) {
    this.logger = logger.withContext(HttpExceptionFilter.name);
  }

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const body = this.toAppError(exception, status);

    const line = `${request?.method ?? '-'} ${request?.url ?? '-'} -> ${status} ${body.statusCode}`;
    if (status >= 500) {
      this.logger.error(line, exception);
    } else {
      this.logger.warn(line);
    }

    response.status(status).json(body);
  }

  /** Normalise an `HttpException` into the {@link AppError} contract. */
  private toAppError(exception: HttpException, status: number): AppError {
    const payload = exception.getResponse();

    if (isAppError(payload)) {
      return payload;
    }

    const statusName = statusNameFor(status);

    return {
      error: labelFor(statusName),
      statusCode: statusName,
      message: messageFrom(payload) ?? exception.message,
    };
  }
}

/** Reverse lookup of an HTTP status number to its `HttpStatus` name. */
function statusNameFor(status: number): string {
  return (
    Object.entries(HttpStatus).find(
      ([, value]) => (value as number) === status,
    )?.[0] ?? 'ERROR'
  );
}

/** `NOT_FOUND` → `Not Found`. */
function labelFor(statusName: string): string {
  return statusName
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Extract a human-readable message from a Nest payload. */
function messageFrom(payload: unknown): string | undefined {
  if (typeof payload === 'string') {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
    if (Array.isArray(message)) {
      return message.filter((m) => typeof m === 'string').join(', ');
    }
  }

  return undefined;
}

/** True when a payload already satisfies the `AppError` contract. */
function isAppError(payload: unknown): payload is AppError {
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  const candidate = payload as Record<string, unknown>;
  return (
    typeof candidate.message === 'string' &&
    typeof candidate.statusCode === 'string' &&
    typeof candidate.error === 'string'
  );
}
