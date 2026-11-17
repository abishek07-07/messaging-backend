import { Injectable } from '@nestjs/common';
import { UsersRepository } from '@features/auth/repository/users.repository';
import { failure, success, Usecase, Response } from '@utils/usecase/index';
import { FriendshipsRepository } from '../repository/friendships.repository';
import {
  FriendRequestListResponse,
  toFriendRequestListResponse,
} from '../response/friend-request-list.response';

/** Input for listing the caller's pending friend requests. */
export interface ListFriendRequestsCommand {
  /** Public UUID of the authenticated caller. */
  actorPublicId: string;
}

/**
 * List all pending friend requests for the caller, split into incoming
 * (received) and outgoing (sent) lists.
 */
@Injectable()
export class ListFriendRequestsUsecase implements Usecase<
  ListFriendRequestsCommand,
  FriendRequestListResponse
> {
  constructor(
    private readonly users: UsersRepository,
    private readonly friendships: FriendshipsRepository,
  ) {}

  async execute(
    command: ListFriendRequestsCommand,
  ): Promise<Response<FriendRequestListResponse>> {
    const actor = await this.users.findByPublicId(command.actorPublicId);
    if (!actor || !actor.is_active) {
      return failure<FriendRequestListResponse>(
        'UNAUTHORIZED',
        'Unauthorized',
        'Your account could not be found',
      );
    }

    const [incoming, outgoing] = await Promise.all([
      this.friendships.listIncomingRequests(actor.id),
      this.friendships.listOutgoingRequests(actor.id),
    ]);

    return success(toFriendRequestListResponse(incoming, outgoing));
  }
}
