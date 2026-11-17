import { Injectable } from '@nestjs/common';
import { UsersRepository } from '@features/auth/repository/users.repository';
import { failure, success, Usecase, Response } from '@utils/usecase/index';
import { FriendshipsRepository } from '../repository/friendships.repository';
import { UserBlocksRepository } from '../repository/user-blocks.repository';
import {
  FriendRequestResponse,
  toFriendRequestResponse,
} from '../response/friend-request.response';

/** Input for sending a friend request. */
export interface SendFriendRequestCommand {
  /** Public UUID of the authenticated caller. */
  actorPublicId: string;

  /** Public UUID of the user receiving the request. */
  recipientPublicId: string;
}

/**
 * Send a friend request to another user.
 *
 * - the recipient is resolved from their **public UUID**,
 * - self-requests and blocked pairs are refused,
 * - an existing accepted/pending request is reported instead of duplicated,
 * - a previously declined pair is re-opened as a fresh pending request.
 */
@Injectable()
export class SendFriendRequestUsecase implements Usecase<
  SendFriendRequestCommand,
  FriendRequestResponse
> {
  constructor(
    private readonly users: UsersRepository,
    private readonly friendships: FriendshipsRepository,
    private readonly blocks: UserBlocksRepository,
  ) {}

  async execute(
    command: SendFriendRequestCommand,
  ): Promise<Response<FriendRequestResponse>> {
    const actor = await this.users.findByPublicId(command.actorPublicId);
    if (!actor || !actor.is_active) {
      return failure<FriendRequestResponse>(
        'UNAUTHORIZED',
        'Unauthorized',
        'Your account could not be found',
      );
    }

    if (command.actorPublicId === command.recipientPublicId) {
      return failure<FriendRequestResponse>(
        'CANNOT_FRIEND_SELF',
        'Bad Request',
        'You cannot send a friend request to yourself',
      );
    }

    const recipient = await this.users.findByPublicId(
      command.recipientPublicId,
    );
    if (!recipient || !recipient.is_active) {
      return failure<FriendRequestResponse>(
        'USER_NOT_FOUND',
        'Not Found',
        'User not found',
      );
    }

    if (await this.blocks.existsBetween(actor.id, recipient.id)) {
      return failure<FriendRequestResponse>(
        'USER_BLOCKED',
        'Forbidden',
        'You cannot send a friend request to this user',
      );
    }

    const existing = await this.friendships.findBetween(actor.id, recipient.id);
    if (existing) {
      switch (existing.status) {
        case 'accepted':
          return failure<FriendRequestResponse>(
            'ALREADY_FRIENDS',
            'Conflict',
            'You are already friends with this user',
          );

        case 'pending':
          return existing.requester_id === actor.id
            ? failure<FriendRequestResponse>(
                'FRIEND_REQUEST_ALREADY_EXISTS',
                'Conflict',
                'You have already sent a friend request to this user',
              )
            : failure<FriendRequestResponse>(
                'FRIEND_REQUEST_ALREADY_RECEIVED',
                'Conflict',
                'This user has already sent you a friend request; accept it instead',
              );

        case 'blocked':
          return failure<FriendRequestResponse>(
            'USER_BLOCKED',
            'Forbidden',
            'You cannot send a friend request to this user',
          );

        case 'declined': {
          const reopened = await this.friendships.reopen(
            existing.public_id,
            actor.id,
            recipient.id,
          );
          if (!reopened) {
            return failure<FriendRequestResponse>(
              'FRIEND_REQUEST_NOT_FOUND',
              'Not Found',
              'Friend request could not be reopened',
            );
          }
          return success(
            toFriendRequestResponse({
              friendship: reopened,
              user: recipient,
              user_internal_id: recipient.id,
            }),
          );
        }
      }
    }

    const friendship = await this.friendships.create({
      requester_id: actor.id,
      addressee_id: recipient.id,
      status: 'pending',
    });

    return success(
      toFriendRequestResponse({
        friendship,
        user: recipient,
        user_internal_id: recipient.id,
      }),
    );
  }
}
