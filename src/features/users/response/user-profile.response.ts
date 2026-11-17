import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, plainToInstance } from 'class-transformer';
import type { UserEntity } from '@features/auth/repository/users.entity';

/**
 * Public profile resolved by UUID.
 *
 * `email` is only populated when the caller is looking up themself — other
 * users' emails are never exposed, matching the discovery endpoints.
 */
@Exclude()
export class UserProfileResponse {
  /** Public UUID sourced from `users.public_id`. */
  @ApiProperty({ example: '6d9c1d0e-…' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'abishek' })
  @Expose()
  username: string;

  @ApiProperty({ example: 'abishek@example.com', nullable: true })
  @Expose()
  email: string | null;

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

  @ApiProperty({ example: '2026-11-06T12:00:00.000Z' })
  @Expose()
  createdAt: Date;
}

/** Map a `users` row to the profile shape. */
export function toUserProfileResponse(
  user: UserEntity,
  includeEmail: boolean,
): UserProfileResponse {
  return plainToInstance(
    UserProfileResponse,
    {
      id: user.public_id,
      username: user.username,
      email: includeEmail ? user.email : null,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      publicKey: user.public_key,
      createdAt: user.created_at,
    },
    { excludeExtraneousValues: true },
  );
}
