import { Injectable } from '@nestjs/common';
import { UsersRepository } from '@features/auth/repository/users.repository';
import { failure, success, Usecase, Response } from '@utils/usecase/index';
import { FriendshipsRepository } from '../repository/friendships.repository';
import { UserBlocksRepository } from '../repository/user-blocks.repository';
import {
  BlockedUserResponse,
  toBlockedUserResponse,
} from '../response/blocked-user.response';

/** Input for unblocking a user. */
export interface UnblockUserCommand {
  /** Public UUID of the authenticated caller. */
  actorPublicId: string;

  /** Public UUID of the user to unblock. */
  targetPublicId: string;
}

/**
 * Remove a block the caller previously created.
 *
 * Any friendship row marked `blocked` is deleted so the pair can send a fresh
 * friend request; a previous friendship is not restored automatically.
 */
@Injectable()
export class UnblockUserUsecase implements Usecase<
  UnblockUserCommand,
  BlockedUserResponse
> {
  constructor(
    private readonly users: UsersRepository,
    private readonly friendships: FriendshipsRepository,
    private readonly blocks: UserBlocksRepository,
  ) {}

  async execute(
    command: UnblockUserCommand,
  ): Promise<Response<BlockedUserResponse>> {
    const actor = await this.users.findByPublicId(command.actorPublicId);
    if (!actor || !actor.is_active) {
      return failure<BlockedUserResponse>(
        'UNAUTHORIZED',
        'Unauthorized',
        'Your account could not be found',
      );
    }

    const target = await this.users.findByPublicId(command.targetPublicId);
    if (!target) {
      return failure<BlockedUserResponse>(
        'USER_NOT_FOUND',
        'Not Found',
        'User not found',
      );
    }

    const block = await this.blocks.findByPair(actor.id, target.id);
    if (!block) {
      return failure<BlockedUserResponse>(
        'BLOCK_NOT_FOUND',
        'Not Found',
        'You have not blocked this user',
      );
    }

    await this.blocks.deleteByPair(actor.id, target.id);
    await this.friendships.deleteBlockedBetween(actor.id, target.id);

    return success(toBlockedUserResponse({ block, user: target }));
  }
}
