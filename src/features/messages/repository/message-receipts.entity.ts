/**
 * Persisted shape of a row in the `message_receipts` table (see `init.sql`).
 *
 * The table uses a composite primary key (`message_id`, `user_id`), so it has
 * no internal `id`; `public_id` is the only public identifier.
 */
export interface MessageReceiptEntity {
  /** Public UUID exposed by the API. */
  public_id: string;

  /** Internal FK to `messages.id` (never exposed). */
  message_id: string;

  /** Internal FK to `users.id` (never exposed). */
  user_id: string;

  read_at: Date;
}

/** Fields accepted when recording a read receipt. */
export type NewMessageReceiptEntity = Pick<
  MessageReceiptEntity,
  'message_id' | 'user_id'
>;
