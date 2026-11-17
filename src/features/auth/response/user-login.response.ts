import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, plainToInstance } from 'class-transformer';
import type { UserEntity } from '../repository/users.entity';
import { UserResponse, toUserResponse } from './user.response';

/** Body of a successful `POST /auth/login` (200). */
@Exclude()
export class UserLoginResponse {
  @ApiProperty({ description: 'Signed JWT access token.' })
  @Expose()
  accessToken: string;

  @ApiProperty({ type: UserResponse })
  @Expose()
  user: UserResponse;
}

/** Map a `users` row + issued token to the login response. */
export function toUserLoginResponse(
  user: UserEntity,
  accessToken: string,
): UserLoginResponse {
  return plainToInstance(
    UserLoginResponse,
    { accessToken, user: toUserResponse(user) },
    { excludeExtraneousValues: true },
  );
}
