import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, plainToInstance } from 'class-transformer';
import type { BlockedUserEntity } from '../repository/user-blocks.entity';
import {
  BlockedUserResponse,
  toBlockedUserResponse,
} from './blocked-user.response';

/** All users blocked by the caller. */
@Exclude()
export class BlockedUserListResponse {
  @ApiProperty({ type: [BlockedUserResponse] })
  @Expose()
  blockedUsers: BlockedUserResponse[];
}

/** Map block rows to the list response. */
export function toBlockedUserListResponse(
  blockedUsers: BlockedUserEntity[],
): BlockedUserListResponse {
  return plainToInstance(
    BlockedUserListResponse,
    { blockedUsers: blockedUsers.map(toBlockedUserResponse) },
    { excludeExtraneousValues: true },
  );
}
