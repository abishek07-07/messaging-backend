import { Injectable } from '@nestjs/common';
import { UsersRepository } from '@features/auth/repository/users.repository';
import { failure, success, Usecase, Response } from '@utils/usecase/index';
import { FriendshipsRepository } from '../repository/friendships.repository';
import {
  FriendRequestResponse,
  toFriendRequestResponse,
} from '../response/friend-request.response';

/** Input for declining a friend request. */
export interface DeclineFriendRequestCommand {
  /** Public UUID of the authenticated caller (the addressee). */
  actorPublicId: string;

  /** Public UUID of the friend request. */
  requestPublicId: string;
}

/**
 * Decline a pending friend request addressed to the caller.
 *
 * Only the addressee can decline. The row is kept with status `declined` so
 * the pair can be re-opened later without duplicating it.
 */
@Injectable()
export class DeclineFriendRequestUsecase implements Usecase<
  DeclineFriendRequestCommand,
  FriendRequestResponse
> {
  constructor(
    private readonly users: UsersRepository,
    private readonly friendships: FriendshipsRepository,
  ) {}

  async execute(
    command: DeclineFriendRequestCommand,
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
        'Only the recipient can decline this friend request',
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
