import { Module } from '@nestjs/common';
import { AuthModule } from '@features/auth/auth.module';
import { FriendsModule } from '@features/friends/friends.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsRepository } from './repository/conversations.repository';
import { ListConversationsUsecase } from './usecase/list-conversations.usecase';

/**
 * Conversations feature.
 *
 * Owns the per-friend chat list and direct-conversation membership.
 * `FriendsModule` exports `FriendshipsRepository`, so the chat list can reuse
 * the accepted-friend query. The repository is exported for `MessagesModule`,
 * which needs conversation lookup and membership checks.
 */
@Module({
  imports: [AuthModule, FriendsModule],
  controllers: [ConversationsController],
  providers: [ConversationsRepository, ListConversationsUsecase],
  exports: [ConversationsRepository],
})
export class ConversationsModule {}
