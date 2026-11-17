import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '@core/database/index';
import type { LatestMessageEntity } from '@features/messages/repository/messages.entity';
import type { MessageEntity } from '@features/messages/repository/messages.entity';
import type {
  ConversationEntity,
  ConversationParticipantEntity,
} from './conversations.entity';
import type { ConversationMemberEntity } from './conversation-members.entity';

/** Table names, kept in one place. */
const CONVERSATIONS_TABLE = 'conversations';
const CONVERSATION_MEMBERS_TABLE = 'conversation_members';
const MESSAGES_TABLE = 'messages';

/** A latest-message row joined with its sender's public summary. */
interface LatestMessageRow extends MessageEntity {
  sender_public_id: string | null;
  sender_username: string | null;
  sender_display_name: string | null;
  sender_avatar_url: string | null;
  sender_public_key: string | null;
}

/** Columns selected by {@link ConversationsRepository.listLatestMessages}. */
const LATEST_MESSAGE_COLUMNS = [
  'm.*',
  'u.public_id as sender_public_id',
  'u.username as sender_username',
  'u.display_name as sender_display_name',
  'u.avatar_url as sender_avatar_url',
  'u.public_key as sender_public_key',
];

/**
 * Data access for conversations and their members.
 *
 * Besides conversation rows this repository reads the two things a chat list
 * needs: each member's public profile and the newest message per conversation.
 * The newest-message read lives here (instead of in `MessagesRepository`) so
 * the chat list can be built without a circular module dependency between the
 * `conversations` and `messages` features.
 */
@Injectable()
export class ConversationsRepository {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  /** Find a conversation by its public UUID. */
  async findByPublicId(publicId: string): Promise<ConversationEntity | null> {
    const conversation = await this.knex<ConversationEntity>(
      CONVERSATIONS_TABLE,
    )
      .where({ public_id: publicId })
      .first();
    return conversation ?? null;
  }

  /**
   * Find the direct conversation shared by two users, if one exists.
   *
   * A direct conversation qualifies when it has `type = 'direct'` and both
   * users are still active members (`left_at IS NULL`).
   */
  async findDirectBetween(
    userAId: string,
    userBId: string,
  ): Promise<ConversationEntity | null> {
    return this.findDirectBetweenIn(this.knex, userAId, userBId);
  }

  /**
   * Return the direct conversation between two users, creating it (and both
   * membership rows) when it does not exist yet.
   *
   * The lookup + insert runs in a transaction guarded by a per-pair advisory
   * lock, so two concurrent calls cannot create duplicate conversations for
   * the same pair — the `conversations` table itself has no pair constraint.
   */
  async findOrCreateDirect(
    userAId: string,
    userBId: string,
  ): Promise<ConversationEntity> {
    const [lowId, highId] = [userAId, userBId].sort((a, b) =>
      BigInt(a) < BigInt(b) ? -1 : 1,
    );

    return this.knex.transaction(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [
        `direct:${lowId}:${highId}`,
      ]);

      const existing = await this.findDirectBetweenIn(trx, userAId, userBId);
      if (existing) {
        return existing;
      }

      const [conversation] = await trx<ConversationEntity>(CONVERSATIONS_TABLE)
        .insert({ type: 'direct', created_by: userAId })
        .returning<ConversationEntity[]>('*');

      await trx(CONVERSATION_MEMBERS_TABLE).insert([
        {
          conversation_id: conversation.id,
          user_id: userAId,
          role: 'member',
        },
        {
          conversation_id: conversation.id,
          user_id: userBId,
          role: 'member',
        },
      ]);

      return conversation;
    });
  }

  /** Whether the user is still an active member of the conversation. */
  async isMember(conversationId: string, userId: string): Promise<boolean> {
    const membership = await this.knex<ConversationMemberEntity>(
      CONVERSATION_MEMBERS_TABLE,
    )
      .select('id')
      .where({ conversation_id: conversationId, user_id: userId })
      .whereNull('left_at')
      .first();

    return Boolean(membership);
  }

  /**
   * Internal id of the other active member. Used for block checks before
   * sending; never exposed to clients.
   */
  async findOtherParticipantInternalId(
    conversationId: string,
    actorId: string,
  ): Promise<string | null> {
    const member = await this.knex<ConversationMemberEntity>(
      CONVERSATION_MEMBERS_TABLE,
    )
      .select('user_id')
      .where({ conversation_id: conversationId })
      .whereNot('user_id', actorId)
      .whereNull('left_at')
      .first();

    return member?.user_id ?? null;
  }

  /**
   * The other active participant of a direct conversation, from the caller's
   * point of view. Returns `null` for group conversations or missing peers.
   */
  async findOtherParticipant(
    conversationId: string,
    actorId: string,
  ): Promise<ConversationParticipantEntity | null> {
    const [participant] = await this.knex(`${CONVERSATION_MEMBERS_TABLE} as m`)
      .join('users as u', 'u.id', 'm.user_id')
      .where('m.conversation_id', conversationId)
      .where('m.user_id', '<>', actorId)
      .whereNull('m.left_at')
      .where('u.is_active', true)
      .limit(1)
      .select<ConversationParticipantEntity[]>([
        'u.public_id',
        'u.username',
        'u.display_name',
        'u.avatar_url',
        'u.public_key',
      ]);

    return participant ?? null;
  }

  /**
   * Newest non-deleted message for each conversation, keyed internally by
   * `conversation_id`.
   *
   * Uses PostgreSQL `DISTINCT ON` so the whole batch is one query instead of
   * one query per conversation.
   */
  async listLatestMessages(
    conversationIds: string[],
  ): Promise<LatestMessageEntity[]> {
    if (conversationIds.length === 0) {
      return [];
    }

    const rows = await this.knex(`${MESSAGES_TABLE} as m`)
      .leftJoin('users as u', 'u.id', 'm.sender_id')
      .distinctOn('m.conversation_id')
      .whereIn('m.conversation_id', conversationIds)
      .orderBy([
        { column: 'm.conversation_id', order: 'asc' },
        { column: 'm.created_at', order: 'desc' },
        { column: 'm.id', order: 'desc' },
      ])
      .select<LatestMessageRow[]>(LATEST_MESSAGE_COLUMNS);

    return rows.map((row) => ({
      conversation_id: row.conversation_id,
      message: this.toMessage(row),
      sender: this.toSender(row),
    }));
  }

  /**
   * Unread message count per conversation for one user, in one query.
   *
   * A message is unread when it was not sent by the user and its internal id is
   * greater than the member's `last_read_message_id`.
   */
  async listUnreadCounts(
    conversationIds: string[],
    userId: string,
  ): Promise<Map<string, number>> {
    if (conversationIds.length === 0) {
      return new Map();
    }

    const rows = await this.knex('conversation_members as cm')
      .join('messages as m', 'm.conversation_id', 'cm.conversation_id')
      .whereIn('cm.conversation_id', conversationIds)
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
      .groupBy('cm.conversation_id')
      .select<{ conversation_id: string; count: string }[]>([
        'cm.conversation_id',
        this.knex.raw('count(m.id) as count'),
      ]);

    return new Map(
      rows.map((row) => [String(row.conversation_id), Number(row.count)]),
    );
  }

  /** Shared direct-conversation lookup, usable inside a transaction. */
  private async findDirectBetweenIn(
    db: Knex | Knex.Transaction,
    userAId: string,
    userBId: string,
  ): Promise<ConversationEntity | null> {
    const [conversation] = await db('conversations as c')
      .join('conversation_members as a', 'a.conversation_id', 'c.id')
      .join('conversation_members as b', 'b.conversation_id', 'c.id')
      .where('c.type', 'direct')
      .where('a.user_id', userAId)
      .whereNull('a.left_at')
      .where('b.user_id', userBId)
      .whereNull('b.left_at')
      .limit(1)
      .select<ConversationEntity[]>(['c.*']);

    return conversation ?? null;
  }

  /** Strip the sender join columns back into a persisted message shape. */
  private toMessage(row: LatestMessageRow): MessageEntity {
    return {
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
  }

  /** Map the joined user columns to the public sender shape. */
  private toSender(row: LatestMessageRow): LatestMessageEntity['sender'] {
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
