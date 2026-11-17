import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_CONNECTION } from '@core/database/index';
import type { NewUserEntity, UserEntity } from './users.entity';

/** Table name, kept in one place. */
const USERS_TABLE = 'users';

/**
 * Data access for users. The only place that touches the `users` table.
 *
 * Column names are snake_case because rows map 1:1 to the database; DTOs in
 * `request/` and `response/` handle the public (camelCase) API shape.
 */
@Injectable()
export class UsersRepository {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  /**
   * Find a user by internal surrogate key.
   *
   * For internal joins only — never serialize the returned `id`. Use
   * {@link findByPublicId} when resolving an identifier that came from a
   * client.
   */
  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.knex<UserEntity>(USERS_TABLE).where({ id }).first();
    return user ?? null;
  }

  /** Find a user by the public UUID exposed to clients. */
  async findByPublicId(publicId: string): Promise<UserEntity | null> {
    const user = await this.knex<UserEntity>(USERS_TABLE)
      .where({ public_id: publicId })
      .first();
    return user ?? null;
  }

  /** Find a user by email (case-insensitive; `email` is CITEXT). */
  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.knex<UserEntity>(USERS_TABLE)
      .where({ email })
      .first();
    return user ?? null;
  }

  /** Find a user by username (case-insensitive; `username` is CITEXT). */
  async findByUsername(username: string): Promise<UserEntity | null> {
    const user = await this.knex<UserEntity>(USERS_TABLE)
      .where({ username })
      .first();
    return user ?? null;
  }

  /** Whether an account with this email already exists. */
  async existsByEmail(email: string): Promise<boolean> {
    return (await this.findByEmail(email)) !== null;
  }

  /** Whether an account with this username already exists. */
  async existsByUsername(username: string): Promise<boolean> {
    return (await this.findByUsername(username)) !== null;
  }

  /** Insert a user and return the created row. */
  async create(data: NewUserEntity): Promise<UserEntity> {
    const [user] = await this.knex<UserEntity>(USERS_TABLE)
      .insert(data)
      .returning<UserEntity[]>('*');
    return user;
  }

  /**
   * Search active users by username or display name.
   *
   * The caller and anyone blocked in either direction are excluded so blocked
   * users cannot be rediscovered through search.
   */
  async search(
    query: string,
    excludeUserId: string,
    limit: number,
  ): Promise<UserEntity[]> {
    const pattern = `%${query}%`;

    return this.knex<UserEntity>(`${USERS_TABLE} as u`)
      .where('u.is_active', true)
      .whereNot('u.id', excludeUserId)
      .where(function () {
        this.whereILike('u.username', pattern).orWhereILike(
          'u.display_name',
          pattern,
        );
      })
      .whereNotExists(
        this.knex('user_blocks')
          .select(this.knex.raw('1'))
          .where(function () {
            this.whereRaw(
              '(user_blocks.blocker_id = u.id AND user_blocks.blocked_id = ?)',
              [excludeUserId],
            ).orWhereRaw(
              '(user_blocks.blocker_id = ? AND user_blocks.blocked_id = u.id)',
              [excludeUserId],
            );
          }),
      )
      .orderBy('u.username', 'asc')
      .limit(limit)
      .select<UserEntity[]>('u.*');
  }

  /** Update the profile fields a user is allowed to change themselves. */
  async updateProfile(
    publicId: string,
    data: {
      display_name?: string;
      avatar_url?: string | null;
      public_key?: string;
    },
  ): Promise<UserEntity | null> {
    const patch: Partial<
      Pick<UserEntity, 'display_name' | 'avatar_url' | 'public_key'>
    > = {};

    if (data.display_name !== undefined) {
      patch.display_name = data.display_name;
    }
    if (data.avatar_url !== undefined) {
      patch.avatar_url = data.avatar_url;
    }
    if (data.public_key !== undefined) {
      patch.public_key = data.public_key;
    }

    if (Object.keys(patch).length === 0) {
      return this.findByPublicId(publicId);
    }

    const [user] = await this.knex<UserEntity>(USERS_TABLE)
      .where({ public_id: publicId })
      .update(patch)
      .returning<UserEntity[]>('*');

    return user ?? null;
  }
}
