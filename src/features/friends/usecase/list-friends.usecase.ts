import { Injectable } from '@nestjs/common';
import { UsersRepository } from '@features/auth/repository/users.repository';
import { failure, success, Usecase, Response } from '@utils/usecase/index';
import { FriendshipsRepository } from '../repository/friendships.repository';
import {
  FriendListResponse,
  toFriendListResponse,
} from '../response/friend-list.response';

/** Input for listing the caller's accepted friends. */
export interface ListFriendsCommand {
  /** Public UUID of the authenticated caller. */
  actorPublicId: string;
}

/** List every accepted friend of the caller. */
@Injectable()
export class ListFriendsUsecase implements Usecase<
  ListFriendsCommand,
  FriendListResponse
> {
  constructor(
    private readonly users: UsersRepository,
    private readonly friendships: FriendshipsRepository,
  ) {}

  async execute(
    command: ListFriendsCommand,
  ): Promise<Response<FriendListResponse>> {
    const actor = await this.users.findByPublicId(command.actorPublicId);
    if (!actor || !actor.is_active) {
      return failure<FriendListResponse>(
        'UNAUTHORIZED',
        'Unauthorized',
        'Your account could not be found',
      );
    }

    const friends = await this.friendships.listFriends(actor.id);

    return success(toFriendListResponse(friends));
  }
}
