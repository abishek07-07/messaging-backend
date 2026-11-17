import type { AppError, ErrorType } from '../errors';

/**
 * Generic, transport-agnostic result type returned by every usecase.
 *
 * A `Response<T>` is a discriminated union on `success`, which lets callers
 * narrow the payload safely:
 *
 * ```ts
 * const res = await usecase.execute(request);
 * if (res.success) {
 *   res.data; // T
 * } else {
 *   res.error; // AppError
 * }
 * ```
 *
 * It intentionally carries no HTTP concepts (no `res`, `req`, status text).
 * Mapping to a transport (HTTP, gRPC, CLI) is the caller's responsibility.
 */
export type Response<T, E = AppError> =
  { success: true; data: T } | { success: false; error: E };

/** Build a successful `Response<T>`. */
export function success<T>(data: T): Response<T> {
  return { success: true, data };
}

/** Build a failed `Response<T>` from a code string or a full `AppError`. */
export function failure<T = never, E = AppError>(
  error: E | ErrorType | string,
  label = 'Error',
  message = label,
): Response<T, E> {
  if (typeof error === 'string') {
    return {
      success: false,
      error: {
        statusCode: error,
        error: label,
        message,
      } as E,
    };
  }

  return { success: false, error: error as E };
}

/** Type guard narrowing any `Response<T>` to its success branch. */
export function isSuccess<T, E>(
  response: Response<T, E>,
): response is { success: true; data: T } {
  return response.success;
}

/** Type guard narrowing any `Response<T>` to its failure branch. */
export function isFailure<T, E>(
  response: Response<T, E>,
): response is { success: false; error: E } {
  return !response.success;
}
