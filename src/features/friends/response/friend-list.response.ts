import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, plainToInstance } from 'class-transformer';
import type { FriendshipWithUserEntity } from '../repository/friendships.entity';
import { FriendResponse, toFriendResponse } from './friend.response';

/** All accepted friends of the caller. */
@Exclude()
export class FriendListResponse {
  @ApiProperty({ type: [FriendResponse] })
  @Expose()
  friends: FriendResponse[];
}

/** Map accepted friendships to the list response. */
export function toFriendListResponse(
  friends: FriendshipWithUserEntity[],
): FriendListResponse {
  return plainToInstance(
    FriendListResponse,
    { friends: friends.map(toFriendResponse) },
    { excludeExtraneousValues: true },
  );
}
