import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, plainToInstance } from 'class-transformer';
import type {
  ContentEncoding,
  LatestMessageEntity,
  MessageType,
} from '@features/messages/repository/messages.entity';

/** The most recent message in a conversation, shown in the chat list. */
@Exclude()
export class LatestMessageResponse {
  /** Public UUID of the message. */
  @ApiProperty({ example: '8f2c8e14-…' })
  @Expose()
  id: string;

  /** Public UUID of the sender, or `null` for deleted/system senders. */
  @ApiProperty({ example: '6d9c1d0e-…', nullable: true })
  @Expose()
  senderId: string | null;

  /** Whether the authenticated caller sent this message. */
  @ApiProperty({ example: true })
  @Expose()
  isMine: boolean;

  @ApiProperty({
    enum: ['text', 'image', 'file', 'audio', 'video', 'system'],
    example: 'text',
  })
  @Expose()
  type: MessageType;

  @ApiProperty({ example: 'See you at 7?', nullable: true })
  @Expose()
  content: string | null;

  /** Ciphertext is never sent to the chat list; the client shows a placeholder. */
  @ApiProperty({
    enum: ['plaintext', 'e2ee', 'server_enc'],
    example: 'e2ee',
  })
  @Expose()
  encoding: ContentEncoding;

  @ApiProperty({ example: '2026-11-07T10:02:00.000Z', nullable: true })
  @Expose()
  deletedAt: Date | null;

  @ApiProperty({ example: '2026-11-07T10:00:00.000Z' })
  @Expose()
  createdAt: Date;
}

/** Map the latest-message view to the chat-list response shape. */
export function toLatestMessageResponse(
  latest: LatestMessageEntity,
  actorInternalId: string,
): LatestMessageResponse {
  return plainToInstance(
    LatestMessageResponse,
    {
      id: latest.message.public_id,
      senderId: latest.sender?.public_id ?? null,
      isMine: latest.message.sender_id === actorInternalId,
      type: latest.message.type,
      content:
        latest.message.encoding === 'e2ee' ? null : latest.message.content,
      encoding: latest.message.encoding,
      deletedAt: latest.message.deleted_at,
      createdAt: latest.message.created_at,
    },
    { excludeExtraneousValues: true },
  );
}
