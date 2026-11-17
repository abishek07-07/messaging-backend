import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/** Route params carrying a conversation's public UUID. */
export class ConversationIdParams {
  @ApiProperty({
    description: 'Public UUID of the conversation.',
    format: 'uuid',
  })
  @IsUUID()
  conversationId: string;
}
