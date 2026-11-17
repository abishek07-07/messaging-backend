import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, plainToInstance } from 'class-transformer';
import type { UserEntity } from '@features/auth/repository/users.entity';

/** Public, minimal user shape used by discovery results. */
@Exclude()
export class UserSummaryResponse {
  /** Public UUID sourced from `users.public_id`. */
  @ApiProperty({ example: '6d9c1d0e-…' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'abishek' })
  @Expose()
  username: string;

  @ApiProperty({ example: 'Abishek', nullable: true })
  @Expose()
  displayName: string | null;

  @ApiProperty({
    example: 'https://cdn.example.com/avatar.png',
    nullable: true,
  })
  @Expose()
  avatarUrl: string | null;

  /** Base64 X25519 public key used for end-to-end encryption. */
  @ApiProperty({ example: 'm5S…', nullable: true })
  @Expose()
  publicKey: string | null;
}

/** Body of `GET /users?search=`. */
@Exclude()
export class UserSearchResponse {
  @ApiProperty({ type: [UserSummaryResponse] })
  @Expose()
  users: UserSummaryResponse[];
}

/** Map a user row to the public discovery shape. */
export function toUserSummaryResponse(user: UserEntity): UserSummaryResponse {
  return plainToInstance(
    UserSummaryResponse,
    {
      id: user.public_id,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      publicKey: user.public_key,
    },
    { excludeExtraneousValues: true },
  );
}

/** Map a list of user rows to the search response. */
export function toUserSearchResponse(users: UserEntity[]): UserSearchResponse {
  return plainToInstance(
    UserSearchResponse,
    { users: users.map(toUserSummaryResponse) },
    { excludeExtraneousValues: true },
  );
}
