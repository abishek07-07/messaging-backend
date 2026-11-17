import type { FriendUserEntity } from './friend-user.entity';

/**
 * Persisted shape of a row in the `user_blocks` table (see `init.sql`).
 *
 * The table uses a composite primary key (`blocker_id`, `blocked_id`), so it
 * has no internal `id`; `public_id` is the only public identifier.
 */
export interface UserBlockEntity {
  /** Public UUID exposed by the API. */
  public_id: string;

  /** Internal FK to `users.id` (never exposed). */
  blocker_id: string;

  /** Internal FK to `users.id` (never exposed). */
  blocked_id: string;

  created_at: Date;
}

/** Fields accepted when creating a block. */
export type NewUserBlockEntity = Pick<
  UserBlockEntity,
  'blocker_id' | 'blocked_id'
>;

/** A block joined with the blocked user, ready for response mapping. */
export interface BlockedUserEntity {
  block: UserBlockEntity;
  user: FriendUserEntity;
}
