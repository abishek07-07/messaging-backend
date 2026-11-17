import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

/** Body of `POST /conversations/:conversationId/read`. */
@Exclude()
export class MarkReadResponse {
  /** Unread messages remaining after the read cursor was advanced. */
  @ApiProperty({ example: 0 })
  @Expose()
  unreadCount: number;
}
