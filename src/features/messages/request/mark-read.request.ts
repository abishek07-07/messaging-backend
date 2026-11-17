import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/** Body of `POST /conversations/:conversationId/read`. */
export class MarkReadRequest {
  /**
   * Public UUID of the newest message the caller has seen. Omit it to mark the
   * newest message in the conversation as read.
   */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  messageId?: string;
}
