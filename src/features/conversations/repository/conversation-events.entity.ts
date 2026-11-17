/** Mirrors the `group_action` PostgreSQL enum. */
export type GroupAction =
  | 'member_added'
  | 'member_removed'
  | 'member_left'
  | 'role_changed'
  | 'title_changed'
  | 'avatar_changed';

/**
 * Persisted shape of a row in the `conversation_events` table (see `init.sql`).
 * This is an append-only audit log for group actions.
 */
export interface ConversationEventEntity {
  /** Internal surrogate key (`BIGSERIAL`). */
  id: string;

  /** Public UUID exposed by the API. */
  public_id: string;

  /** Internal FK to `conversations.id` (never exposed). */
  conversation_id: string;

  /** Internal FK to `users.id` (never exposed). */
  actor_id: string | null;

  /** Internal FK to `users.id` (never exposed). */
  target_id: string | null;

  action: GroupAction;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

/** Fields accepted when appending a conversation event. */
export type NewConversationEventEntity = Pick<
  ConversationEventEntity,
  'conversation_id' | 'action'
> &
  Partial<Pick<ConversationEventEntity, 'actor_id' | 'target_id' | 'metadata'>>;
