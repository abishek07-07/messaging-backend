import { Injectable } from '@nestjs/common';
import { UsersRepository } from '@features/auth/repository/users.repository';
import { failure, success, Usecase, Response } from '@utils/usecase/index';
import { FriendshipsRepository } from '../repository/friendships.repository';
import { FriendResponse, toFriendResponse } from '../response/friend.response';

/** Input for removing a friend. */
export interface RemoveFriendCommand {
  /** Public UUID of the authenticated caller. */
  actorPublicId: string;

  /** Public UUID of the friend to remove. */
  friendPublicId: string;
}

/** Remove an accepted friendship between the caller and another user. */
@Injectable()
export class RemoveFriendUsecase implements Usecase<
  RemoveFriendCommand,
  FriendResponse
> {
  constructor(
    private readonly users: UsersRepository,
    private readonly friendships: FriendshipsRepository,
  ) {}

  async execute(
    command: RemoveFriendCommand,
  ): Promise<Response<FriendResponse>> {
    const actor = await this.users.findByPublicId(command.actorPublicId);
    if (!actor || !actor.is_active) {
      return failure<FriendResponse>(
        'UNAUTHORIZED',
        'Unauthorized',
        'Your account could not be found',
      );
    }

    const friend = await this.users.findByPublicId(command.friendPublicId);
    if (!friend) {
      return failure<FriendResponse>(
        'USER_NOT_FOUND',
        'Not Found',
        'User not found',
      );
    }

    const friendship = await this.friendships.findBetween(actor.id, friend.id);
    if (!friendship || friendship.status !== 'accepted') {
      return failure<FriendResponse>(
        'FRIENDSHIP_NOT_FOUND',
        'Not Found',
        'You are not friends with this user',
      );
    }

    await this.friendships.deleteByPublicId(friendship.public_id);

    return success(
      toFriendResponse({
        friendship,
        user: friend,
        user_internal_id: friend.id,
      }),
    );
  }
}
