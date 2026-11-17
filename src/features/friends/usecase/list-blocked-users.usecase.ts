import { Injectable } from '@nestjs/common';
import { UsersRepository } from '@features/auth/repository/users.repository';
import { failure, success, Usecase, Response } from '@utils/usecase/index';
import { UserBlocksRepository } from '../repository/user-blocks.repository';
import {
  BlockedUserListResponse,
  toBlockedUserListResponse,
} from '../response/blocked-user-list.response';

/** Input for listing users blocked by the caller. */
export interface ListBlockedUsersCommand {
  /** Public UUID of the authenticated caller. */
  actorPublicId: string;
}

/** List every user the caller has blocked. */
@Injectable()
export class ListBlockedUsersUsecase implements Usecase<
  ListBlockedUsersCommand,
  BlockedUserListResponse
> {
  constructor(
    private readonly users: UsersRepository,
    private readonly blocks: UserBlocksRepository,
  ) {}

  async execute(
    command: ListBlockedUsersCommand,
  ): Promise<Response<BlockedUserListResponse>> {
    const actor = await this.users.findByPublicId(command.actorPublicId);
    if (!actor || !actor.is_active) {
      return failure<BlockedUserListResponse>(
        'UNAUTHORIZED',
        'Unauthorized',
        'Your account could not be found',
      );
    }

    const blockedUsers = await this.blocks.listBlocked(actor.id);

    return success(toBlockedUserListResponse(blockedUsers));
  }
}
