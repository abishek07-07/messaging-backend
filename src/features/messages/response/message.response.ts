import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, plainToInstance } from 'class-transformer';
import type {
  ContentEncoding,
  MessageSenderEntity,
  MessageType,
  MessageWithSenderEntity,
} from '../repository/messages.entity';

/** Public summary of the user who sent a message. */
@Exclude()
export class MessageSenderResponse {
  /** Public UUID sourced from `users.public_id`. */
  @ApiProperty({ example: '6d9c1d0e-…' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'abishek' })
  @Expose()
  username: string;

  @ApiProperty({ example: 'Abishek', nullable: true })
  @Expose()
  displayName: string | null;

  @ApiProperty({
    example: 'https://cdn.example.com/avatar.png',
    nullable: true,
  })
  @Expose()
  avatarUrl: string | null;

  /** Base64 X25519 public key used for end-to-end encryption. */
  @ApiProperty({ example: 'm5S…', nullable: true })
  @Expose()
  publicKey: string | null;
}

/** A single message in a conversation. */
@Exclude()
export class MessageResponse {
  /** Public UUID of the message. */
  @ApiProperty({ example: '8f2c8e14-…' })
  @Expose()
  id: string;

  /** Sender's public profile, or `null` for deleted/system senders. */
  @ApiProperty({ type: MessageSenderResponse, nullable: true })
  @Expose()
  sender: MessageSenderResponse | null;

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

  @ApiProperty({
    enum: ['plaintext', 'e2ee', 'server_enc'],
    example: 'plaintext',
  })
  @Expose()
  encoding: ContentEncoding;

  /** Per-recipient wrapped session keys for `e2ee` messages. */
  @ApiProperty({ type: Object, nullable: true })
  @Expose()
  cryptoMetadata: Record<string, unknown> | null;

  @ApiProperty({ example: '2026-11-07T10:00:00.000Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: '2026-11-07T10:01:00.000Z', nullable: true })
  @Expose()
  editedAt: Date | null;

  @ApiProperty({ example: '2026-11-07T10:02:00.000Z', nullable: true })
  @Expose()
  deletedAt: Date | null;

  /** Client-generated id used to reconcile optimistic sends. */
  @ApiProperty({ example: '2f8c4b18-…', nullable: true })
  @Expose()
  clientMessageId: string | null;

  /** The message this one replies to, when it was loaded with the page. */
  @ApiProperty({ type: () => MessageResponse, nullable: true })
  @Expose()
  replyTo: MessageResponse | null;
}

/** Map a joined message row to its public shape. */
export function toMessageSenderResponse(
  sender: MessageSenderEntity,
): MessageSenderResponse {
  return plainToInstance(
    MessageSenderResponse,
    {
      id: sender.public_id,
      username: sender.username,
      displayName: sender.display_name,
      avatarUrl: sender.avatar_url,
      publicKey: sender.public_key,
    },
    { excludeExtraneousValues: true },
  );
}

/** Map a message + sender view to the public message shape. */
export function toMessageResponse(
  view: MessageWithSenderEntity,
  actorInternalId: string,
  includeReply = true,
): MessageResponse {
  return plainToInstance(
    MessageResponse,
    {
      id: view.message.public_id,
      sender: view.sender ? toMessageSenderResponse(view.sender) : null,
      isMine: view.message.sender_id === actorInternalId,
      type: view.message.type,
      content: view.message.content,
      encoding: view.message.encoding,
      cryptoMetadata: view.message.crypto_metadata,
      createdAt: view.message.created_at,
      editedAt: view.message.edited_at,
      deletedAt: view.message.deleted_at,
      clientMessageId: view.message.client_message_id,
      replyTo:
        includeReply && view.replyTo
          ? toMessageResponse(view.replyTo, actorInternalId, false)
          : null,
    },
    { excludeExtraneousValues: true },
  );
}
