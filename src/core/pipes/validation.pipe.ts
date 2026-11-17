import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ValidationPipeOptions } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import type { FieldError } from '@utils/errors/index';

/**
 * Body returned by {@link ValidationException} and shown directly in the
 * frontend. Mirrors `AppError`, with field-level `details`.
 */
export interface ValidationExceptionBody {
  /** Short label, always `Bad Request` for validation failures. */
  error: 'Bad Request';
  /** Machine-readable code, always `VALIDATION_ERROR`. */
  statusCode: 'VALIDATION_ERROR';
  /** Human-readable summary of the first field error. */
  message: string;
  /** One entry per offending field, in declaration order. */
  details: FieldError[];
}

/**
 * Turn `class-validator` errors into a flat, frontend-friendly field list.
 *
 * Child errors (nested objects) are flattened into dotted paths
 * (`address.city`), so the frontend can map them straight to form fields.
 */
function flatten(errors: ValidationError[], parentPath = ''): FieldError[] {
  const result: FieldError[] = [];

  for (const error of errors) {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        result.push({ field: path, message });
      }
    }

    if (error.children?.length) {
      result.push(...flatten(error.children, path));
    }
  }

  return result;
}

/**
 * Application validation pipe.
 *
 * Reads request DTOs (bodies, queries, params) and:
 * - **removes extra elements** not declared on the DTO (`whitelist`),
 * - **rejects** requests that still carry them (`forbidNonWhitelisted`),
 * - **stops at the first error per field** (`stopAtFirstError`),
 * - throws a `BadRequestException` whose body follows
 *   {@link ValidationExceptionBody}, ready for the frontend to render.
 *
 * Register globally in `main.ts`:
 *
 * ```ts
 * app.useGlobalPipes(new AppValidationPipe());
 * ```
 */
export class AppValidationPipe extends ValidationPipe {
  constructor(options: ValidationPipeOptions = {}) {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
      transformOptions: { enableImplicitConversion: true },
      ...options,
      exceptionFactory: (errors: ValidationError[]) => {
        const details = flatten(errors);
        const first = details[0];

        const body: ValidationExceptionBody = {
          error: 'Bad Request',
          statusCode: 'VALIDATION_ERROR',
          message: first
            ? `${first.field}: ${first.message}`
            : 'Validation failed',
          details,
        };

        return new BadRequestException(body);
      },
    });
  }
}
