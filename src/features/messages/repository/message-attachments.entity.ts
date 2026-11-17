/**
 * Persisted shape of a row in the `message_attachments` table (see `init.sql`).
 */
export interface MessageAttachmentEntity {
  /** Internal surrogate key (`BIGSERIAL`). */
  id: string;

  /** Public UUID exposed by the API. */
  public_id: string;

  /** Internal FK to `messages.id` (never exposed). */
  message_id: string;

  storage_key: string;
  file_name: string | null;
  mime_type: string | null;

  /** `BIGINT` — `pg` returns int8 as a string. */
  size_bytes: string | null;

  encryption_meta: Record<string, unknown> | null;
  created_at: Date;
}

/** Fields accepted when attaching a file to a message. */
export type NewMessageAttachmentEntity = Pick<
  MessageAttachmentEntity,
  'message_id' | 'storage_key'
> &
  Partial<
    Pick<
      MessageAttachmentEntity,
      'file_name' | 'mime_type' | 'size_bytes' | 'encryption_meta'
    >
  >;
