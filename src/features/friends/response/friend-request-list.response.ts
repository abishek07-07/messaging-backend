import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, plainToInstance } from 'class-transformer';
import type { FriendshipWithUserEntity } from '../repository/friendships.entity';
import {
  FriendRequestResponse,
  toFriendRequestResponse,
} from './friend-request.response';

/** All pending friend requests for the caller, split by direction. */
@Exclude()
export class FriendRequestListResponse {
  /** Requests other users sent to the caller. */
  @ApiProperty({ type: [FriendRequestResponse] })
  @Expose()
  incoming: FriendRequestResponse[];

  /** Requests the caller sent that are still waiting for a response. */
  @ApiProperty({ type: [FriendRequestResponse] })
  @Expose()
  outgoing: FriendRequestResponse[];
}

/** Map both request directions to the list response. */
export function toFriendRequestListResponse(
  incoming: FriendshipWithUserEntity[],
  outgoing: FriendshipWithUserEntity[],
): FriendRequestListResponse {
  return plainToInstance(
    FriendRequestListResponse,
    {
      incoming: incoming.map(toFriendRequestResponse),
      outgoing: outgoing.map(toFriendRequestResponse),
    },
    { excludeExtraneousValues: true },
  );
}
