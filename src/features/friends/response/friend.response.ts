import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, plainToInstance } from 'class-transformer';
import type { FriendshipWithUserEntity } from '../repository/friendships.entity';
import {
  FriendUserResponse,
  toFriendUserResponse,
} from './friend-user.response';

/** An accepted friend of the caller. */
@Exclude()
export class FriendResponse {
  /** Public UUID of the friendship row. */
  @ApiProperty({ example: '4b1f0f52-…' })
  @Expose()
  id: string;

  @ApiProperty({ type: FriendUserResponse })
  @Expose()
  user: FriendUserResponse;

  /** When the request was accepted. */
  @ApiProperty({ example: '2026-11-07T10:00:00.000Z' })
  @Expose()
  friendsSince: Date;
}

/** Map an accepted friendship + friend to the public response. */
export function toFriendResponse(
  view: FriendshipWithUserEntity,
): FriendResponse {
  return plainToInstance(
    FriendResponse,
    {
      id: view.friendship.public_id,
      user: toFriendUserResponse(view.user),
      friendsSince: view.friendship.updated_at,
    },
    { excludeExtraneousValues: true },
  );
}
