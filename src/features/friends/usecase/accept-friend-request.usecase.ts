import { Injectable } from '@nestjs/common';
import { UsersRepository } from '@features/auth/repository/users.repository';
import { failure, success, Usecase, Response } from '@utils/usecase/index';
import { FriendshipsRepository } from '../repository/friendships.repository';
import { UserBlocksRepository } from '../repository/user-blocks.repository';
import {
  FriendRequestResponse,
  toFriendRequestResponse,
} from '../response/friend-request.response';

/** Input for accepting a friend request. */
export interface AcceptFriendRequestCommand {
  /** Public UUID of the authenticated caller (the addressee). */
  actorPublicId: string;

  /** Public UUID of the friend request. */
  requestPublicId: string;
}

/**
 * Accept a pending friend request addressed to the caller.
 *
 * Only the addressee can accept; once accepted the pair appears in both users'
 * friend lists.
 */
@Injectable()
export class AcceptFriendRequestUsecase implements Usecase<
  AcceptFriendRequestCommand,
  FriendRequestResponse
> {
  constructor(
    private readonly users: UsersRepository,
    private readonly friendships: FriendshipsRepository,
    private readonly blocks: UserBlocksRepository,
  ) {}

  async execute(
    command: AcceptFriendRequestCommand,
  ): Promise<Response<FriendRequestResponse>> {
    const actor = await this.users.findByPublicId(command.actorPublicId);
    if (!actor || !actor.is_active) {
      return failure<FriendRequestResponse>(
        'UNAUTHORIZED',
        'Unauthorized',
        'Your account could not be found',
      );
    }

    const friendship = await this.friendships.findByPublicId(
      command.requestPublicId,
    );
    if (!friendship) {
      return failure<FriendRequestResponse>(
        'FRIEND_REQUEST_NOT_FOUND',
        'Not Found',
        'Friend request not found',
      );
    }

    if (friendship.addressee_id !== actor.id) {
      return failure<FriendRequestResponse>(
        'FORBIDDEN',
        'Forbidden',
        'Only the recipient can accept this friend request',
      );
    }

    if (friendship.status !== 'pending') {
      return failure<FriendRequestResponse>(
        'FRIEND_REQUEST_NOT_PENDING',
        'Conflict',
        'This friend request is no longer pending',
      );
    }

    if (await this.blocks.existsBetween(actor.id, friendship.requester_id)) {
      return failure<FriendRequestResponse>(
        'USER_BLOCKED',
        'Forbidden',
        'You cannot accept a friend request from a blocked user',
      );
    }

    const updated = await this.friendships.updateStatus(
      friendship.public_id,
      'accepted',
    );
    if (!updated) {
      return failure<FriendRequestResponse>(
        'FRIEND_REQUEST_NOT_FOUND',
        'Not Found',
        'Friend request not found',
      );
    }

    const requester = await this.users.findById(friendship.requester_id);
    if (!requester) {
      return failure<FriendRequestResponse>(
        'USER_NOT_FOUND',
        'Not Found',
        'The user who sent this request no longer exists',
      );
    }

    return success(
      toFriendRequestResponse({
        friendship: updated,
        user: requester,
        user_internal_id: requester.id,
      }),
    );
  }
}
