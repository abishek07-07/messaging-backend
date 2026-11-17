import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/** Route params carrying a friend request's public UUID. */
export class FriendRequestIdParams {
  @ApiProperty({
    description: 'Public UUID of the friend request.',
    format: 'uuid',
  })
  @IsUUID()
  requestId: string;
}
