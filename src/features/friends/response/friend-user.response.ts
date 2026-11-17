import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, plainToInstance } from 'class-transformer';
import type { FriendUserEntity } from '../repository/friend-user.entity';

/** Public summary of a user inside a friendship or block response. */
@Exclude()
export class FriendUserResponse {
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

/** Map a public user entity to its response shape. */
export function toFriendUserResponse(
  user: FriendUserEntity,
): FriendUserResponse {
  return plainToInstance(
    FriendUserResponse,
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
