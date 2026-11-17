/** Mirrors the `message_type` PostgreSQL enum. */
export type MessageType =
  'text' | 'image' | 'file' | 'audio' | 'video' | 'system';

/** Mirrors the `content_encoding` PostgreSQL enum. */
export type ContentEncoding = 'plaintext' | 'e2ee' | 'server_enc';

/**
 * Persisted shape of a row in the `messages` table (see `init.sql`).
 */
export interface MessageEntity {
  /** Internal surrogate key (`BIGSERIAL`). */
  id: string;

  /** Public UUID exposed by the API. */
  public_id: string;

  /** Internal FK to `conversations.id` (never exposed). */
  conversation_id: string;

  /** Internal FK to `users.id` (never exposed). */
  sender_id: string | null;

  /** Client-generated UUID used for optimistic sends / deduplication. */
  client_message_id: string | null;

  type: MessageType;
  content: string | null;
  encoding: ContentEncoding;
  crypto_metadata: Record<string, unknown> | null;

  /** Internal FK to `messages.id` (never exposed). */
  reply_to_id: string | null;

  deleted_at: Date | null;
  edited_at: Date | null;
  created_at: Date;
}

/** Fields accepted when creating a message. */
export type NewMessageEntity = Pick<MessageEntity, 'conversation_id'> &
  Partial<
    Pick<
      MessageEntity,
      | 'sender_id'
      | 'client_message_id'
      | 'type'
      | 'content'
      | 'encoding'
      | 'crypto_metadata'
      | 'reply_to_id'
    >
  >;

/**
 * Public summary of a message sender.
 *
 * `null` on a joined message means the sender account was deleted
 * (`sender_id` is `ON DELETE SET NULL`) or the message is a system message.
 */
export interface MessageSenderEntity {
  /** Public UUID exposed by the API. */
  public_id: string;

  username: string;
  display_name: string | null;
  avatar_url: string | null;

  /** Base64 X25519 public key used for end-to-end encryption. */
  public_key: string | null;
}

/** A message joined with its sender's public summary. */
export interface MessageWithSenderEntity {
  message: MessageEntity;
  sender: MessageSenderEntity | null;
  /** The message this one replies to, when loaded. */
  replyTo?: MessageWithSenderEntity | null;
}

/** One page of messages, already ordered oldest → newest. */
export interface MessagePageEntity {
  messages: MessageWithSenderEntity[];
  /** Whether older messages exist beyond this page. */
  hasMore: boolean;
}

/** Latest message per conversation, used by the chat list. */
export interface LatestMessageEntity {
  /** Internal FK to `conversations.id` (never exposed). */
  conversation_id: string;

  message: MessageEntity;
  sender: MessageSenderEntity | null;
}
