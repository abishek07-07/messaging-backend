import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '@core/database/index';
import type {
  FriendshipEntity,
  FriendshipStatus,
  FriendshipSummaryEntity,
  FriendshipWithUserEntity,
  NewFriendshipEntity,
} from './friendships.entity';

/** Table name, kept in one place. */
const FRIENDSHIPS_TABLE = 'friendships';

/** A friendship joined with both participants (internal repository shape). */
interface FriendshipPairRow {
  id: string;
  public_id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: Date;
  updated_at: Date;

  requester_public_id: string;
  requester_username: string;
  requester_display_name: string | null;
  requester_avatar_url: string | null;
  requester_public_key: string | null;

  addressee_public_id: string;
  addressee_username: string;
  addressee_display_name: string | null;
  addressee_avatar_url: string | null;
  addressee_public_key: string | null;
}

/** Columns selected by {@link FriendshipsRepository.pairQuery}. */
const PAIR_COLUMNS = [
  'f.id',
  'f.public_id',
  'f.requester_id',
  'f.addressee_id',
  'f.status',
  'f.created_at',
  'f.updated_at',
  'requester.public_id as requester_public_id',
  'requester.username as requester_username',
  'requester.display_name as requester_display_name',
  'requester.avatar_url as requester_avatar_url',
  'requester.public_key as requester_public_key',
  'addressee.public_id as addressee_public_id',
  'addressee.username as addressee_username',
  'addressee.display_name as addressee_display_name',
  'addressee.avatar_url as addressee_avatar_url',
  'addressee.public_key as addressee_public_key',
];

/**
 * Data access for friendships. The only place that touches the `friendships`
 * table.
 *
 * Public methods that list data take the **current user's internal id** so the
 * database — not the caller — enforces whose rows are returned. Entities are
 * joined with the other participant and returned as
 * {@link FriendshipWithUserEntity} for the response mappers.
 */
@Injectable()
export class FriendshipsRepository {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  /** Find a friendship by its public UUID. */
  async findByPublicId(publicId: string): Promise<FriendshipEntity | null> {
    const friendship = await this.knex<FriendshipEntity>(FRIENDSHIPS_TABLE)
      .where({ public_id: publicId })
      .first();
    return friendship ?? null;
  }

  /**
   * Find the single canonical row between two users, regardless of direction.
   *
   * `friendships` enforces one row per pair, so a request can be pending in one
   * direction, accepted, declined, or blocked.
   */
  async findBetween(
    userAId: string,
    userBId: string,
  ): Promise<FriendshipEntity | null> {
    const friendship = await this.knex<FriendshipEntity>(FRIENDSHIPS_TABLE)
      .where(function () {
        this.where({ requester_id: userAId, addressee_id: userBId }).orWhere({
          requester_id: userBId,
          addressee_id: userAId,
        });
      })
      .first();
    return friendship ?? null;
  }

  /** Insert a friendship request and return the created row. */
  async create(data: NewFriendshipEntity): Promise<FriendshipEntity> {
    const [friendship] = await this.knex<FriendshipEntity>(FRIENDSHIPS_TABLE)
      .insert(data)
      .returning<FriendshipEntity[]>('*');
    return friendship;
  }

  /** Update a friendship's status (accept, decline, cancel, block). */
  async updateStatus(
    publicId: string,
    status: FriendshipStatus,
  ): Promise<FriendshipEntity | null> {
    const [friendship] = await this.knex<FriendshipEntity>(FRIENDSHIPS_TABLE)
      .where({ public_id: publicId })
      .update({ status })
      .returning<FriendshipEntity[]>('*');
    return friendship ?? null;
  }

  /**
   * Re-open a previously declined pair as a fresh pending request.
   *
   * The requester/addressee may change if the other side now initiates, so both
   * sides are written explicitly.
   */
  async reopen(
    publicId: string,
    requesterId: string,
    addresseeId: string,
  ): Promise<FriendshipEntity | null> {
    const [friendship] = await this.knex<FriendshipEntity>(FRIENDSHIPS_TABLE)
      .where({ public_id: publicId })
      .update({
        requester_id: requesterId,
        addressee_id: addresseeId,
        status: 'pending',
      })
      .returning<FriendshipEntity[]>('*');
    return friendship ?? null;
  }

  /** Delete a friendship row by public UUID. */
  async deleteByPublicId(publicId: string): Promise<number> {
    return this.knex(FRIENDSHIPS_TABLE).where({ public_id: publicId }).del();
  }

  /** Pending requests sent *to* the user. */
  async listIncomingRequests(
    userId: string,
  ): Promise<FriendshipWithUserEntity[]> {
    const rows = await this.pairQuery(userId)
      .where('f.addressee_id', userId)
      .where('f.status', 'pending')
      .orderBy('f.created_at', 'desc')
      .select<FriendshipPairRow[]>(PAIR_COLUMNS);

    return rows.map((row) => this.toView(row, userId));
  }

  /** Pending requests sent *by* the user. */
  async listOutgoingRequests(
    userId: string,
  ): Promise<FriendshipWithUserEntity[]> {
    const rows = await this.pairQuery(userId)
      .where('f.requester_id', userId)
      .where('f.status', 'pending')
      .orderBy('f.created_at', 'desc')
      .select<FriendshipPairRow[]>(PAIR_COLUMNS);

    return rows.map((row) => this.toView(row, userId));
  }

  /** Accepted friends of the user. */
  async listFriends(userId: string): Promise<FriendshipWithUserEntity[]> {
    const rows = await this.pairQuery(userId)
      .where('f.status', 'accepted')
      .orderBy('f.updated_at', 'desc')
      .select<FriendshipPairRow[]>(PAIR_COLUMNS);

    return rows.map((row) => this.toView(row, userId));
  }

  /**
   * Mark any existing row between two users as blocked.
   *
   * This covers pending requests and accepted friendships alike, so a blocked
   * pair cannot keep interacting through an old request.
   */
  async markBlockedBetween(userAId: string, userBId: string): Promise<void> {
    await this.knex(FRIENDSHIPS_TABLE)
      .where(function () {
        this.where({ requester_id: userAId, addressee_id: userBId }).orWhere({
          requester_id: userBId,
          addressee_id: userAId,
        });
      })
      .update({ status: 'blocked' });
  }

  /** Remove a blocked pair row after an unblock, allowing a fresh request. */
  async deleteBlockedBetween(userAId: string, userBId: string): Promise<void> {
    await this.knex(FRIENDSHIPS_TABLE)
      .where(function () {
        this.where({ requester_id: userAId, addressee_id: userBId }).orWhere({
          requester_id: userBId,
          addressee_id: userAId,
        });
      })
      .where('status', 'blocked')
      .del();
  }

  /** Base query joining both participants, limited to the current user's rows. */
  private pairQuery(userId: string) {
    return this.knex<FriendshipPairRow>(`${FRIENDSHIPS_TABLE} as f`)
      .join('users as requester', 'requester.id', 'f.requester_id')
      .join('users as addressee', 'addressee.id', 'f.addressee_id')
      .where(function () {
        this.where('f.requester_id', userId).orWhere('f.addressee_id', userId);
      });
  }

  /** Pick the participant that is *not* the current user. */
  private toView(
    row: FriendshipPairRow,
    currentUserId: string,
  ): FriendshipWithUserEntity {
    const friendship: FriendshipSummaryEntity = {
      id: row.id,
      public_id: row.public_id,
      requester_id: row.requester_id,
      addressee_id: row.addressee_id,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    const isRequester = String(row.requester_id) === String(currentUserId);

    return {
      friendship,
      user_internal_id: isRequester ? row.addressee_id : row.requester_id,
      user: isRequester
        ? {
            public_id: row.addressee_public_id,
            username: row.addressee_username,
            display_name: row.addressee_display_name,
            avatar_url: row.addressee_avatar_url,
            public_key: row.addressee_public_key,
          }
        : {
            public_id: row.requester_public_id,
            username: row.requester_username,
            display_name: row.requester_display_name,
            avatar_url: row.requester_avatar_url,
            public_key: row.requester_public_key,
          },
    };
  }
}
