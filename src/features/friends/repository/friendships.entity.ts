import type { FriendUserEntity } from './friend-user.entity';

/** Mirrors the `friendship_status` PostgreSQL enum. */
export type FriendshipStatus = 'pending' | 'accepted' | 'blocked' | 'declined';

/**
 * Persisted shape of a row in the `friendships` table (see `init.sql`).
 *
 * `user_low_id` / `user_high_id` are generated columns used to enforce one row
 * per canonical user pair; they are internal and never exposed.
 */
export interface FriendshipEntity {
  /** Internal surrogate key (`BIGSERIAL`). */
  id: string;

  /** Public UUID exposed by the API. */
  public_id: string;

  /** Internal FK to `users.id` (never exposed). */
  requester_id: string;

  /** Internal FK to `users.id` (never exposed). */
  addressee_id: string;

  /** Generated canonical pair — internal only. */
  user_low_id: string;
  user_high_id: string;

  status: FriendshipStatus;
  created_at: Date;
  updated_at: Date;
}

/** The columns needed by the API, without internal generated columns. */
export type FriendshipSummaryEntity = Pick<
  FriendshipEntity,
  | 'id'
  | 'public_id'
  | 'requester_id'
  | 'addressee_id'
  | 'status'
  | 'created_at'
  | 'updated_at'
>;

/**
 * A friendship joined with the *other* participant, from the point of view of
 * the authenticated user. Used directly by response mappers.
 */
export interface FriendshipWithUserEntity {
  friendship: FriendshipSummaryEntity;
  user: FriendUserEntity;
  /** Internal id of the other user — for joins only, never serialized. */
  user_internal_id: string;
}

/** Fields accepted when creating a friendship request. */
export type NewFriendshipEntity = Pick<
  FriendshipEntity,
  'requester_id' | 'addressee_id'
> & {
  status?: FriendshipStatus;
};
