/** Mirrors the `invite_status` PostgreSQL enum. */
export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'revoked';

/**
 * Persisted shape of a row in the `conversation_invites` table (see
 * `init.sql`).
 */
export interface ConversationInviteEntity {
  /** Internal surrogate key (`BIGSERIAL`). */
  id: string;

  /** Public UUID exposed by the API. */
  public_id: string;

  /** Internal FK to `conversations.id` (never exposed). */
  conversation_id: string;

  /** Internal FK to `users.id` (never exposed). */
  inviter_id: string;

  /** Internal FK to `users.id` (never exposed). */
  invitee_id: string;

  status: InviteStatus;
  created_at: Date;
  responded_at: Date | null;
}

/** Fields accepted when creating a conversation invite. */
export type NewConversationInviteEntity = Pick<
  ConversationInviteEntity,
  'conversation_id' | 'inviter_id' | 'invitee_id'
> & {
  status?: InviteStatus;
};
