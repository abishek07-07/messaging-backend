/**
 * The usecase contract.
 *
 * Every business action in a feature is implemented as a single class that
 * implements `Usecase<Request, Data>`:
 *
 * - `Request` — the validated input (typically a DTO from `features/<f>/request`).
 * - `Data`    — the success payload (typically a DTO from `features/<f>/response`).
 *
 * `execute` always resolves to a `Response<Data>`, so callers never deal with
 * thrown errors or transport-specific result shapes.
 *
 * ```ts
 * class UserRegisterUsecase implements Usecase<RegisterRequestDto, UserResponseDto> {
 *   async execute(request: RegisterRequestDto): Promise<Response<UserResponseDto>> {
 *     // ...
 *     return success(user);
 *   }
 * }
 * ```
 */

export type { Response } from './response';

export { success, failure, isSuccess, isFailure } from './response';

export type {
  AppError,
  ErrorType,
  FieldError,
  ValidationError,
} from '../errors';

import type { Response } from './response';

/** A unit of business behavior: maps a `Request` to a `Response<Data>`. */
export interface Usecase<Request, Data> {
  execute(request: Request): Promise<Response<Data>>;
}
