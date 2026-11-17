import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/** Route params for endpoints scoped to a single message. */
export class MessageIdParams {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  messageId: string;
}
