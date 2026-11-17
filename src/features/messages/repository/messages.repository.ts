import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '@core/database/index';
import type {
  ContentEncoding,
  MessageEntity,
  MessagePageEntity,
  MessageSenderEntity,
  MessageWithSenderEntity,
  NewMessageEntity,
} from './messages.entity';

/** Table name, kept in one place. */
const MESSAGES_TABLE = 'messages';

/** A keyset-pagination cursor: the oldest message the client already has. */
export interface MessageCursor {
  created_at: Date;
  /** Internal `messages.id`, used as the tie-breaker for equal timestamps. */
  id: string;
}

/** A message row joined with its sender's public summary. */
interface MessageRow extends MessageEntity {
  sender_public_id: string | null;
  sender_username: string | null;
  sender_display_name: string | null;
  sender_avatar_url: string | null;
  sender_public_key: string | null;
}

/** Columns selected by the message queries. */
const MESSAGE_COLUMNS = [
  'm.id',
  'm.public_id',
  'm.conversation_id',
  'm.sender_id',
  'm.client_message_id',
  'm.type',
  'm.content',
  'm.encoding',
  'm.crypto_metadata',
  'm.reply_to_id',
  'm.deleted_at',
  'm.edited_at',
  'm.created_at',
  'u.public_id as sender_public_id',
  'u.username as sender_username',
  'u.display_name as sender_display_name',
  'u.avatar_url as sender_avatar_url',
  'u.public_key as sender_public_key',
];

/**
 * Data access for messages. The only place that touches the `messages` table
 * for message reads.
 *
 * Pages are keyset-paginated: callers pass the oldest message they have seen
 * (`before`), and the query returns the `limit` messages immediately older than
 * that cursor. Ordering uses `(created_at, id)` so messages with identical
 * timestamps cannot repeat or disappear between pages.
 */
@Injectable()
export class MessagesRepository {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  /**
   * Latest page of messages in a conversation, ordered oldest → newest.
   *
   * Fetches one extra row to compute `hasMore` without a second count query.
   */
  async listByConversation(
    conversationId: string,
    limit: number,
    before?: MessageCursor,
  ): Promise<MessagePageEntity> {
    const query = this.knex(`${MESSAGES_TABLE} as m`)
      .leftJoin('users as u', 'u.id', 'm.sender_id')
      .where('m.conversation_id', conversationId);

    if (before) {
      query.whereRaw('(m.created_at, m.id) < (?, ?)', [
        before.created_at,
        before.id,
      ]);
    }

    const rows = await query
      .orderBy([
        { column: 'm.created_at', order: 'desc' },
        { column: 'm.id', order: 'desc' },
      ])
      .limit(limit + 1)
      .select<MessageRow[]>(MESSAGE_COLUMNS);

    const hasMore = rows.length > limit;

    // The query walks backwards from newest; the API returns a chat page in
    // reading order (oldest first).
    const page = rows.slice(0, limit).reverse();
    const messages = page.map((row) => this.toView(row));

    const replyIds = [
      ...new Set(
        messages
          .map((view) => view.message.reply_to_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    if (replyIds.length > 0) {
      const replies = await this.listReplyTargets(replyIds);
      const replyById = new Map(
        replies.map((reply) => [reply.message.id, reply]),
      );

      for (const view of messages) {
        if (view.message.reply_to_id) {
          view.replyTo = replyById.get(view.message.reply_to_id) ?? null;
        }
      }
    }

    return { messages, hasMore };
  }

  /**
   * Find a message by public UUID, scoped to a conversation.
   *
   * Deleted messages are included: the chat list still shows a tombstone and a
   * deleted message is a valid pagination cursor / read marker.
   */
  async findByPublicIdInConversation(
    publicId: string,
    conversationId: string,
  ): Promise<MessageEntity | null> {
    const message = await this.knex<MessageEntity>(MESSAGES_TABLE)
      .where({ public_id: publicId, conversation_id: conversationId })
      .first();
    return message ?? null;
  }

  /** Find a message by its public UUID, regardless of conversation. */
  async findByPublicId(publicId: string): Promise<MessageEntity | null> {
    const message = await this.knex<MessageEntity>(MESSAGES_TABLE)
      .where({ public_id: publicId })
      .first();
    return message ?? null;
  }

  /** Find a sender's message by the client-generated deduplication id. */
  async findBySenderAndClientId(
    senderId: string,
    clientMessageId: string,
  ): Promise<MessageEntity | null> {
    const message = await this.knex<MessageEntity>(MESSAGES_TABLE)
      .where({ sender_id: senderId, client_message_id: clientMessageId })
      .first();
    return message ?? null;
  }

  /** Insert a message and return the created row. */
  async create(data: NewMessageEntity): Promise<MessageEntity> {
    const [message] = await this.knex<MessageEntity>(MESSAGES_TABLE)
      .insert(data)
      .returning<MessageEntity[]>('*');
    return message;
  }

  /** Update a non-deleted message's text, optionally its encoding and keys. */
  async updateContent(
    publicId: string,
    content: string,
    encoding?: ContentEncoding,
    cryptoMetadata?: Record<string, unknown>,
  ): Promise<MessageEntity | null> {
    const [message] = await this.knex<MessageEntity>(MESSAGES_TABLE)
      .where({ public_id: publicId })
      .whereNull('deleted_at')
      .update({
        content,
        ...(encoding !== undefined ? { encoding } : {}),
        ...(cryptoMetadata !== undefined
          ? { crypto_metadata: cryptoMetadata }
          : {}),
        edited_at: this.knex.fn.now(),
      })
      .returning<MessageEntity[]>('*');
    return message ?? null;
  }

  /** Soft-delete a message: clear its content and set `deleted_at`. */
  async softDelete(publicId: string): Promise<MessageEntity | null> {
    const [message] = await this.knex<MessageEntity>(MESSAGES_TABLE)
      .where({ public_id: publicId })
      .whereNull('deleted_at')
      .update({ content: null, deleted_at: this.knex.fn.now() })
      .returning<MessageEntity[]>('*');
    return message ?? null;
  }

  /** Load a message with its sender and reply target. */
  async findViewById(
    publicId: string,
  ): Promise<MessageWithSenderEntity | null> {
    const row = await this.knex(`${MESSAGES_TABLE} as m`)
      .leftJoin('users as u', 'u.id', 'm.sender_id')
      .where('m.public_id', publicId)
      .select<MessageRow[]>(MESSAGE_COLUMNS)
      .first();

    if (!row) return null;

    const view = this.toView(row);
    if (view.message.reply_to_id) {
      const [reply] = await this.listReplyTargets([view.message.reply_to_id]);
      view.replyTo = reply ?? null;
    }
    return view;
  }

  /** Load reply targets by internal message id (deleted tombstones included). */
  async listReplyTargets(
    ids: string[],
  ): Promise<MessageWithSenderEntity[]> {
    if (ids.length === 0) return [];

    const rows = await this.knex(`${MESSAGES_TABLE} as m`)
      .leftJoin('users as u', 'u.id', 'm.sender_id')
      .whereIn('m.id', ids)
      .select<MessageRow[]>(MESSAGE_COLUMNS);

    return rows.map((row) => this.toView(row));
  }

  /** Newest non-deleted message in a conversation, if any. */
  async findLatestByConversation(
    conversationId: string,
  ): Promise<MessageEntity | null> {
    const message = await this.knex<MessageEntity>(MESSAGES_TABLE)
      .where({ conversation_id: conversationId })
      .whereNull('deleted_at')
      .orderBy([
        { column: 'created_at', order: 'desc' },
        { column: 'id', order: 'desc' },
      ])
      .first();
    return message ?? null;
  }

  /**
   * Advance the caller's read cursor to `messageInternalId` and record receipts
   * for every message up to it that they did not send themselves.
   */
  async markRead(
    conversationId: string,
    userId: string,
    messageInternalId: string,
  ): Promise<void> {
    await this.knex('conversation_members')
      .where({ conversation_id: conversationId, user_id: userId })
      .whereNull('left_at')
      .update({
        last_read_message_id: this.knex.raw(
          'GREATEST(COALESCE(last_read_message_id, 0), ?)',
          [messageInternalId],
        ),
      });

    await this.knex.raw(
      `INSERT INTO message_receipts (message_id, user_id)
       SELECT m.id, ?
       FROM messages m
       WHERE m.conversation_id = ?
         AND m.id <= ?
         AND m.sender_id IS NOT NULL
         AND m.sender_id <> ?
         AND m.deleted_at IS NULL
       ON CONFLICT DO NOTHING`,
      [userId, conversationId, messageInternalId, userId],
    );
  }

  /** Count unread messages for one user in one conversation. */
  async countUnread(
    conversationId: string,
    userId: string,
  ): Promise<number> {
    const row = await this.knex('conversation_members as cm')
      .join('messages as m', 'm.conversation_id', 'cm.conversation_id')
      .where('cm.conversation_id', conversationId)
      .where('cm.user_id', userId)
      .whereNull('cm.left_at')
      .whereNull('m.deleted_at')
      .whereNotNull('m.sender_id')
      .where('m.sender_id', '<>', userId)
      .where(function () {
        this.whereNull('cm.last_read_message_id').orWhereRaw(
          'm.id > cm.last_read_message_id',
        );
      })
      .count<{ count: string }[]>('m.id as count')
      .first();

    return Number(row?.count ?? 0);
  }

  /** Map a joined row into the message + sender view. */
  private toView(row: MessageRow): MessageWithSenderEntity {
    const message: MessageEntity = {
      id: row.id,
      public_id: row.public_id,
      conversation_id: row.conversation_id,
      sender_id: row.sender_id,
      client_message_id: row.client_message_id,
      type: row.type,
      content: row.content,
      encoding: row.encoding,
      crypto_metadata: row.crypto_metadata,
      reply_to_id: row.reply_to_id,
      deleted_at: row.deleted_at,
      edited_at: row.edited_at,
      created_at: row.created_at,
    };

    return { message, sender: this.toSender(row), replyTo: null };
  }

  /** Map the joined user columns to the public sender shape. */
  private toSender(row: MessageRow): MessageSenderEntity | null {
    if (!row.sender_public_id || !row.sender_username) {
      return null;
    }

    return {
      public_id: row.sender_public_id,
      username: row.sender_username,
      display_name: row.sender_display_name,
      avatar_url: row.sender_avatar_url,
      public_key: row.sender_public_key,
    };
  }
}
