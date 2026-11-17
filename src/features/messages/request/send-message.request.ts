import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { ContentEncoding } from '../repository/messages.entity';

/** Body of `POST /conversations/:conversationId/messages`. */
export class SendMessageRequest {
  /** Plaintext, or base64 ciphertext when `encoding` is `e2ee`. */
  @ApiProperty({ example: 'See you at 7?' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(22000)
  content: string;

  /** How `content` is encoded. Defaults to plaintext for older clients. */
  @ApiPropertyOptional({
    enum: ['plaintext', 'e2ee', 'server_enc'],
    default: 'plaintext',
  })
  @IsOptional()
  @IsIn(['plaintext', 'e2ee', 'server_enc'])
  encoding?: ContentEncoding;

  /** Per-recipient wrapped session keys for `e2ee` messages. */
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  cryptoMetadata?: Record<string, unknown>;

  /**
   * Client-generated UUID used to reconcile an optimistic send and to make
   * retries idempotent.
   */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  clientMessageId?: string;

  /** Public UUID of the message being replied to. */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  replyToId?: string;
}
