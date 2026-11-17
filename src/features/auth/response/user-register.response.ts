import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, plainToInstance } from 'class-transformer';
import type { UserEntity } from '../repository/users.entity';
import { UserResponse, toUserResponse } from './user.response';

/** Body of a successful `POST /auth/register` (201). */
@Exclude()
export class UserRegisterResponse {
  @ApiProperty({ type: UserResponse })
  @Expose()
  user: UserResponse;
}

/** Map a `users` row to the register response. */
export function toUserRegisterResponse(user: UserEntity): UserRegisterResponse {
  return plainToInstance(
    UserRegisterResponse,
    { user: toUserResponse(user) },
    { excludeExtraneousValues: true },
  );
}
