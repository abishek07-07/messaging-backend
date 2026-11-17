import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, plainToInstance } from 'class-transformer';
import type { UserEntity } from '../repository/users.entity';

/**
 * Public shape of a user. Internal fields (`password_hash`, `is_active`…)
 * are intentionally never exposed.
 */
@Exclude()
export class UserResponse {
  /**
   * Public UUID. Sourced from `users.public_id`; the internal numeric
   * `users.id` is never exposed.
   */
  @ApiProperty({ example: '6d9c1d0e-…' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'abishek' })
  @Expose()
  username: string;

  @ApiProperty({ example: 'abishek@example.com' })
  @Expose()
  email: string;

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

/** Map a `users` row to the public shape. */
export function toUserResponse(user: UserEntity): UserResponse {
  return plainToInstance(
    UserResponse,
    {
      id: user.public_id,
      username: user.username,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      publicKey: user.public_key,
      createdAt: user.created_at,
    },
    { excludeExtraneousValues: true },
  );
}
