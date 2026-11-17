/** Mirrors the `conversation_type` PostgreSQL enum. */
export type ConversationType = 'direct' | 'group';

/**
 * Persisted shape of a row in the `conversations` table (see `init.sql`).
 */
export interface ConversationEntity {
  /** Internal surrogate key (`BIGSERIAL`). */
  id: string;

  /** Public UUID exposed by the API. */
  public_id: string;

  type: ConversationType;
  title: string | null;
  avatar_url: string | null;

  /** Internal FK to `users.id` (never exposed). */
  created_by: string | null;

  created_at: Date;
  updated_at: Date;
}

/** Fields accepted when creating a conversation. */
export type NewConversationEntity = Partial<
  Pick<ConversationEntity, 'type' | 'title' | 'avatar_url' | 'created_by'>
>;

/**
 * Public summary of a conversation participant.
 *
 * Only fields safe to expose to clients are included; internal ids, emails,
 * and password hashes never appear here.
 */
export interface ConversationParticipantEntity {
  /** Public UUID exposed by the API. */
  public_id: string;

  username: string;
  display_name: string | null;
  avatar_url: string | null;

  /** Base64 X25519 public key used for end-to-end encryption. */
  public_key: string | null;
}
