import { Injectable } from '@nestjs/common';
import { HashingService } from '@core/hashing/index';
import { JsonWebTokenService } from '@core/jsonwebtoken/jwt.service';
import { failure, success, Usecase, Response } from '@utils/usecase/index';
import { UsersRepository } from '../repository/users.repository';
import { UserLoginRequest } from '../request/user-login.request';
import {
  toUserLoginResponse,
  UserLoginResponse,
} from '../response/user-login.response';

/**
 * Log in with email + password.
 *
 * Verifies the password against the stored hash and issues a JWT access token.
 * Unknown email and wrong password produce the same error so accounts cannot be
 * enumerated.
 */
@Injectable()
export class UserLoginUsecase implements Usecase<
  UserLoginRequest,
  UserLoginResponse
> {
  constructor(
    private readonly users: UsersRepository,
    private readonly hashing: HashingService,
    private readonly tokens: JsonWebTokenService,
  ) {}

  async execute(
    request: UserLoginRequest,
  ): Promise<Response<UserLoginResponse>> {
    const invalidCredentials = failure<UserLoginResponse>(
      'INVALID_CREDENTIALS',
      'Unauthorized',
      'Invalid email or password',
    );

    const user = await this.users.findByEmail(request.email);
    if (!user) {
      return invalidCredentials;
    }

    const passwordMatches = await this.hashing.verify(
      request.password,
      user.password_hash,
    );
    if (!passwordMatches) {
      return invalidCredentials;
    }

    const accessToken = this.tokens.signIn({
      // The JWT subject is the public UUID, never the internal numeric id.
      sub: user.public_id,
      username: user.username,
      email: user.email,
    });

    return success(toUserLoginResponse(user, accessToken));
  }
}
