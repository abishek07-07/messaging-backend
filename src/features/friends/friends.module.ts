import { Module } from '@nestjs/common';
import { AuthModule } from '@features/auth/auth.module';
import { FriendRequestsController } from './friend-requests.controller';
import { FriendsController } from './friends.controller';
import { FriendshipsRepository } from './repository/friendships.repository';
import { UserBlocksRepository } from './repository/user-blocks.repository';
import { AcceptFriendRequestUsecase } from './usecase/accept-friend-request.usecase';
import { BlockUserUsecase } from './usecase/block-user.usecase';
import { CancelFriendRequestUsecase } from './usecase/cancel-friend-request.usecase';
import { DeclineFriendRequestUsecase } from './usecase/decline-friend-request.usecase';
import { ListBlockedUsersUsecase } from './usecase/list-blocked-users.usecase';
import { ListFriendRequestsUsecase } from './usecase/list-friend-requests.usecase';
import { ListFriendsUsecase } from './usecase/list-friends.usecase';
import { RemoveFriendUsecase } from './usecase/remove-friend.usecase';
import { SendFriendRequestUsecase } from './usecase/send-friend-request.usecase';
import { UnblockUserUsecase } from './usecase/unblock-user.usecase';

/**
 * Friends feature.
 *
 * Owns friend requests, accepted friends, and block/unblock behavior.
 * `AuthModule` exports `UsersRepository`, so this module resolves users by
 * public UUID without reaching into auth internals.
 */
@Module({
  imports: [AuthModule],
  controllers: [FriendRequestsController, FriendsController],
  providers: [
    FriendshipsRepository,
    UserBlocksRepository,
    SendFriendRequestUsecase,
    ListFriendRequestsUsecase,
    AcceptFriendRequestUsecase,
    DeclineFriendRequestUsecase,
    CancelFriendRequestUsecase,
    ListFriendsUsecase,
    RemoveFriendUsecase,
    BlockUserUsecase,
    UnblockUserUsecase,
    ListBlockedUsersUsecase,
  ],
  exports: [FriendshipsRepository, UserBlocksRepository],
})
export class FriendsModule {}
