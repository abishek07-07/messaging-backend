import { Injectable } from '@nestjs/common';
import { UsersRepository } from '@features/auth/repository/users.repository';
import { failure, success, Usecase, Response } from '@utils/usecase/index';
import {
  UserSearchResponse,
  toUserSearchResponse,
} from '../response/user-summary.response';

/** Input for user discovery. */
export interface SearchUsersCommand {
  /** Public UUID of the authenticated caller. */
  actorPublicId: string;

  /** Username or display-name fragment. */
  search?: string;

  /** Maximum results (default 20). */
  limit?: number;
}

/**
 * Find active users by username or display name.
 *
 * The caller and anyone blocked in either direction are excluded. Only the
 * minimal public profile is returned — never emails or internal ids.
 */
@Injectable()
export class SearchUsersUsecase implements Usecase<
  SearchUsersCommand,
  UserSearchResponse
> {
  constructor(private readonly users: UsersRepository) {}

  async execute(
    command: SearchUsersCommand,
  ): Promise<Response<UserSearchResponse>> {
    const actor = await this.users.findByPublicId(command.actorPublicId);
    if (!actor || !actor.is_active) {
      return failure<UserSearchResponse>(
        'UNAUTHORIZED',
        'Unauthorized',
        'Your account could not be found',
      );
    }

    const search = command.search?.trim() ?? '';
    if (search.length < 2) {
      return success(toUserSearchResponse([]));
    }

    const users = await this.users.search(
      search,
      actor.id,
      command.limit ?? 20,
    );

    return success(toUserSearchResponse(users));
  }
}
