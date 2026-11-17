import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '@core/database/index';
import type {
  BlockedUserEntity,
  NewUserBlockEntity,
  UserBlockEntity,
} from './user-blocks.entity';

/** Table name, kept in one place. */
const USER_BLOCKS_TABLE = 'user_blocks';

/** A block joined with the blocked user (internal repository shape). */
interface BlockedUserRow {
  block_public_id: string;
  blocker_id: string;
  blocked_id: string;
  block_created_at: Date;

  user_public_id: string;
  user_username: string;
  user_display_name: string | null;
  user_avatar_url: string | null;
  user_public_key: string | null;
}

/**
 * Data access for user blocks. The only place that touches the `user_blocks`
 * table.
 *
 * Blocks are directional: Alice blocking Bob does not automatically mean Bob
 * blocked Alice. `existsBetween` treats either direction as a block, which is
 * what friend requests need.
 */
@Injectable()
export class UserBlocksRepository {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  /** Find the block created by `blockerId` against `blockedId`. */
  async findByPair(
    blockerId: string,
    blockedId: string,
  ): Promise<UserBlockEntity | null> {
    const block = await this.knex<UserBlockEntity>(USER_BLOCKS_TABLE)
      .where({ blocker_id: blockerId, blocked_id: blockedId })
      .first();
    return block ?? null;
  }

  /**
   * Whether either user has blocked the other.
   *
   * Friend requests are refused in both directions so a blocked user cannot
   * reach the blocker through a request.
   */
  async existsBetween(userAId: string, userBId: string): Promise<boolean> {
    const block = await this.knex<UserBlockEntity>(USER_BLOCKS_TABLE)
      .select('public_id')
      .where(function () {
        this.where({
          blocker_id: userAId,
          blocked_id: userBId,
        }).orWhere({
          blocker_id: userBId,
          blocked_id: userAId,
        });
      })
      .first();

    return Boolean(block);
  }

  /**
   * Insert a block. Idempotent: blocking an already-blocked user returns the
   * existing row instead of failing on the composite primary key.
   */
  async create(data: NewUserBlockEntity): Promise<UserBlockEntity> {
    const [created] = await this.knex<UserBlockEntity>(USER_BLOCKS_TABLE)
      .insert(data)
      .onConflict(['blocker_id', 'blocked_id'])
      .ignore()
      .returning<UserBlockEntity[]>('*');

    if (created) {
      return created;
    }

    const existing = await this.findByPair(data.blocker_id, data.blocked_id);
    if (!existing) {
      throw new Error('Failed to persist or find the user block');
    }
    return existing;
  }

  /** Remove a block created by `blockerId` against `blockedId`. */
  async deleteByPair(blockerId: string, blockedId: string): Promise<number> {
    return this.knex(USER_BLOCKS_TABLE)
      .where({ blocker_id: blockerId, blocked_id: blockedId })
      .del();
  }

  /** All users blocked by the given user, newest first. */
  async listBlocked(blockerId: string): Promise<BlockedUserEntity[]> {
    const rows = await this.knex(`${USER_BLOCKS_TABLE} as b`)
      .join('users as u', 'u.id', 'b.blocked_id')
      .where('b.blocker_id', blockerId)
      .orderBy('b.created_at', 'desc')
      .select<BlockedUserRow[]>([
        'b.public_id as block_public_id',
        'b.blocker_id',
        'b.blocked_id',
        'b.created_at as block_created_at',
        'u.public_id as user_public_id',
        'u.username as user_username',
        'u.display_name as user_display_name',
        'u.avatar_url as user_avatar_url',
        'u.public_key as user_public_key',
      ]);

    return rows.map((row) => this.toView(row));
  }

  /** Map a joined row into the block + blocked-user view. */
  private toView(row: BlockedUserRow): BlockedUserEntity {
    return {
      block: {
        public_id: row.block_public_id,
        blocker_id: row.blocker_id,
        blocked_id: row.blocked_id,
        created_at: row.block_created_at,
      },
      user: {
        public_id: row.user_public_id,
        username: row.user_username,
        display_name: row.user_display_name,
        avatar_url: row.user_avatar_url,
        public_key: row.user_public_key,
      },
    };
  }
}
