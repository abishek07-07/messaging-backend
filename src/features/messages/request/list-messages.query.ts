import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** Query for `GET /conversations/:conversationId/messages`. */
export class ListMessagesQuery {
  /**
   * Public UUID of the **oldest message already loaded** by the client.
   * Messages strictly older than this cursor are returned. Omit it for the
   * newest page.
   */
  @ApiPropertyOptional({
    description:
      'Public UUID of the oldest loaded message; returns messages older than it.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  cursor?: string;

  /** Page size. Defaults to 10, capped at 50. */
  @ApiPropertyOptional({
    description: 'Number of messages to return (1–50).',
    default: 10,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
