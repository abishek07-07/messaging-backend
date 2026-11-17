/**
 * Generic application error contract.
 *
 * Every error surfaced by the app — validation failures, domain rule
 * violations, infrastructure faults — is represented by this shape so that
 * callers and the transport layer can handle errors uniformly.
 *
 * ```ts
 * const error: AppError = {
 *   message: 'A user with this email already exists',
 *   statusCode: 'EMAIL_ALREADY_EXISTS',
 *   error: 'Conflict',
 * };
 * ```
 */
export interface AppError<Details = unknown> {
  /** Human-readable description of what went wrong and, where possible, why. */
  message: string;

  /** Machine-readable code identifying the error, e.g. `USER_NOT_FOUND`. */
  statusCode: string;

  /** Short error label, e.g. `Bad Request` / `Conflict`. */
  error: string;

  /** Optional structured context (field errors, conflicting values…). */
  details?: Details;
}

/**
 * Convenience alias mirroring the original `Response<T>` naming so both live
 * side by side: a `Response<T>` carries `ErrorType`, and `ErrorType` is the
 * generic error contract above.
 */
export type ErrorType<Details = unknown> = AppError<Details>;

/** Field-level validation detail, useful inside `AppError.details`. */
export interface FieldError {
  field: string;
  message: string;
}

/** `AppError` specialised for input validation failures. */
export type ValidationError = AppError<FieldError[]>;
