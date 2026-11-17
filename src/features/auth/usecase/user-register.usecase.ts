import { Injectable } from '@nestjs/common';
import { HashingService } from '@core/hashing/index';
import { failure, success, Usecase, Response } from '@utils/usecase/index';
import { UsersRepository } from '../repository/users.repository';
import { UserRegisterRequest } from '../request/user-register.request';
import {
  toUserRegisterResponse,
  UserRegisterResponse,
} from '../response/user-register.response';

/**
 * Register a new user.
 *
 * 1. enforce uniqueness of email and username,
 * 2. hash the password via `core/hashing` (never store plaintext),
 * 3. persist through the repository,
 * 4. return the public user shape.
 */
@Injectable()
export class UserRegisterUsecase implements Usecase<
  UserRegisterRequest,
  UserRegisterResponse
> {
  constructor(
    private readonly users: UsersRepository,
    private readonly hashing: HashingService,
  ) {}

  async execute(
    request: UserRegisterRequest,
  ): Promise<Response<UserRegisterResponse>> {
    if (await this.users.existsByEmail(request.email)) {
      return failure<UserRegisterResponse>(
        'EMAIL_ALREADY_EXISTS',
        'Conflict',
        'That email is already registered',
      );
    }

    if (await this.users.existsByUsername(request.username)) {
      return failure<UserRegisterResponse>(
        'USERNAME_ALREADY_EXISTS',
        'Conflict',
        'That username is taken',
      );
    }

    const passwordHash = await this.hashing.hash(request.password);

    const user = await this.users.create({
      username: request.username,
      email: request.email,
      password_hash: passwordHash,
      display_name: request.displayName ?? null,
    });

    return success(toUserRegisterResponse(user));
  }
}
