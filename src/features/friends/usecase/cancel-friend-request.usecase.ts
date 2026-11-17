import { Injectable } from '@nestjs/common';
import { UsersRepository } from '@features/auth/repository/users.repository';
import { failure, success, Usecase, Response } from '@utils/usecase/index';
import { FriendshipsRepository } from '../repository/friendships.repository';
import {
  FriendRequestResponse,
  toFriendRequestResponse,
} from '../response/friend-request.response';

/** Input for cancelling a sent friend request. */
export interface CancelFriendRequestCommand {
  /** Public UUID of the authenticated caller (the requester). */
  actorPublicId: string;

  /** Public UUID of the friend request. */
  requestPublicId: string;
}

/**
 * Cancel a pending friend request the caller previously sent.
 *
 * Only the requester can cancel. The row moves to `declined` so it can be
 * re-opened by either side later without another duplicate.
 */
@Injectable()
export class CancelFriendRequestUsecase implements Usecase<
  CancelFriendRequestCommand,
  FriendRequestResponse
> {
  constructor(
    private readonly users: UsersRepository,
    private readonly friendships: FriendshipsRepository,
  ) {}

  async execute(
    command: CancelFriendRequestCommand,
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

    if (friendship.requester_id !== actor.id) {
      return failure<FriendRequestResponse>(
        'FORBIDDEN',
        'Forbidden',
        'Only the sender can cancel this friend request',
      );
    }

    if (friendship.status !== 'pending') {
      return failure<FriendRequestResponse>(
        'FRIEND_REQUEST_NOT_PENDING',
        'Conflict',
        'This friend request is no longer pending',
      );
    }

    const updated = await this.friendships.updateStatus(
      friendship.public_id,
      'declined',
    );
    if (!updated) {
      return failure<FriendRequestResponse>(
        'FRIEND_REQUEST_NOT_FOUND',
        'Not Found',
        'Friend request not found',
      );
    }

    const addressee = await this.users.findById(friendship.addressee_id);
    if (!addressee) {
      return failure<FriendRequestResponse>(
        'USER_NOT_FOUND',
        'Not Found',
        'The user this request was sent to no longer exists',
      );
    }

    return success(
      toFriendRequestResponse({
        friendship: updated,
        user: addressee,
        user_internal_id: addressee.id,
      }),
    );
  }
}
