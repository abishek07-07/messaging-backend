import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { ContentEncoding } from '../repository/messages.entity';

/** Body of `PATCH /messages/:messageId`. */
export class EditMessageRequest {
  /** Plaintext, or base64 ciphertext when `encoding` is `e2ee`. */
  @ApiProperty({ example: 'See you at 8?' })
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
}
