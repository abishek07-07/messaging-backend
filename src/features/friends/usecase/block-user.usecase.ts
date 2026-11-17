import { Injectable } from '@nestjs/common';
import { UsersRepository } from '@features/auth/repository/users.repository';
import { failure, success, Usecase, Response } from '@utils/usecase/index';
import { FriendshipsRepository } from '../repository/friendships.repository';
import { UserBlocksRepository } from '../repository/user-blocks.repository';
import {
  BlockedUserResponse,
  toBlockedUserResponse,
} from '../response/blocked-user.response';

/** Input for blocking a user. */
export interface BlockUserCommand {
  /** Public UUID of the authenticated caller. */
  actorPublicId: string;

  /** Public UUID of the user to block. */
  targetPublicId: string;
}

/**
 * Block another user.
 *
 * Blocks are stored in `user_blocks` (the canonical block list) and any
 * existing friendship/request between the two users is marked `blocked`.
 */
@Injectable()
export class BlockUserUsecase implements Usecase<
  BlockUserCommand,
  BlockedUserResponse
> {
  constructor(
    private readonly users: UsersRepository,
    private readonly friendships: FriendshipsRepository,
    private readonly blocks: UserBlocksRepository,
  ) {}

  async execute(
    command: BlockUserCommand,
  ): Promise<Response<BlockedUserResponse>> {
    const actor = await this.users.findByPublicId(command.actorPublicId);
    if (!actor || !actor.is_active) {
      return failure<BlockedUserResponse>(
        'UNAUTHORIZED',
        'Unauthorized',
        'Your account could not be found',
      );
    }

    if (command.actorPublicId === command.targetPublicId) {
      return failure<BlockedUserResponse>(
        'CANNOT_BLOCK_SELF',
        'Bad Request',
        'You cannot block yourself',
      );
    }

    const target = await this.users.findByPublicId(command.targetPublicId);
    if (!target || !target.is_active) {
      return failure<BlockedUserResponse>(
        'USER_NOT_FOUND',
        'Not Found',
        'User not found',
      );
    }

    const block = await this.blocks.create({
      blocker_id: actor.id,
      blocked_id: target.id,
    });

    await this.friendships.markBlockedBetween(actor.id, target.id);

    return success(toBlockedUserResponse({ block, user: target }));
  }
}
