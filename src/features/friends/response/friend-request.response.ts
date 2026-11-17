import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, plainToInstance } from 'class-transformer';
import type {
  FriendshipStatus,
  FriendshipWithUserEntity,
} from '../repository/friendships.entity';
import {
  FriendUserResponse,
  toFriendUserResponse,
} from './friend-user.response';

/** A friend request or friendship, from the caller's point of view. */
@Exclude()
export class FriendRequestResponse {
  /** Public UUID of the friendship/request row. */
  @ApiProperty({ example: '4b1f0f52-…' })
  @Expose()
  id: string;

  /** The other participant: the sender for incoming requests, the recipient for outgoing ones. */
  @ApiProperty({ type: FriendUserResponse })
  @Expose()
  user: FriendUserResponse;

  @ApiProperty({
    enum: ['pending', 'accepted', 'declined', 'blocked'],
    example: 'pending',
  })
  @Expose()
  status: FriendshipStatus;

  @ApiProperty({ example: '2026-11-07T10:00:00.000Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: '2026-11-07T10:00:00.000Z' })
  @Expose()
  updatedAt: Date;
}

/** Map a friendship + other participant to the public response. */
export function toFriendRequestResponse(
  view: FriendshipWithUserEntity,
): FriendRequestResponse {
  return plainToInstance(
    FriendRequestResponse,
    {
      id: view.friendship.public_id,
      user: toFriendUserResponse(view.user),
      status: view.friendship.status,
      createdAt: view.friendship.created_at,
      updatedAt: view.friendship.updated_at,
    },
    { excludeExtraneousValues: true },
  );
}
