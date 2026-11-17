import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, plainToInstance } from 'class-transformer';
import type { BlockedUserEntity } from '../repository/user-blocks.entity';
import {
  FriendUserResponse,
  toFriendUserResponse,
} from './friend-user.response';

/** A user blocked by the caller. */
@Exclude()
export class BlockedUserResponse {
  /** Public UUID of the block row. */
  @ApiProperty({ example: '9f2c8e14-…' })
  @Expose()
  id: string;

  @ApiProperty({ type: FriendUserResponse })
  @Expose()
  user: FriendUserResponse;

  @ApiProperty({ example: '2026-11-07T10:00:00.000Z' })
  @Expose()
  blockedAt: Date;
}

/** Map a block + blocked user to the public response. */
export function toBlockedUserResponse(
  view: BlockedUserEntity,
): BlockedUserResponse {
  return plainToInstance(
    BlockedUserResponse,
    {
      id: view.block.public_id,
      user: toFriendUserResponse(view.user),
      blockedAt: view.block.created_at,
    },
    { excludeExtraneousValues: true },
  );
}
