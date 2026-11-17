/** Mirrors the `member_role` PostgreSQL enum. */
export type MemberRole = 'owner' | 'admin' | 'member';

/**
 * Persisted shape of a row in the `conversation_members` table (see
 * `init.sql`).
 */
export interface ConversationMemberEntity {
  /** Internal surrogate key (`BIGSERIAL`). */
  id: string;

  /** Public UUID exposed by the API. */
  public_id: string;

  /** Internal FK to `conversations.id` (never exposed). */
  conversation_id: string;

  /** Internal FK to `users.id` (never exposed). */
  user_id: string;

  role: MemberRole;
  joined_at: Date;
  left_at: Date | null;
  is_muted: boolean;
  is_pinned: boolean;

  /** Internal FK to `messages.id` (never exposed). */
  last_read_message_id: string | null;
}

/** Fields accepted when adding a member to a conversation. */
export type NewConversationMemberEntity = Pick<
  ConversationMemberEntity,
  'conversation_id' | 'user_id'
> &
  Partial<
    Pick<
      ConversationMemberEntity,
      'role' | 'is_muted' | 'is_pinned' | 'last_read_message_id'
    >
  >;
