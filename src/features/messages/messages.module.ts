import { Module } from '@nestjs/common';
import { AuthModule } from '@features/auth/auth.module';
import { ConversationsModule } from '@features/conversations/conversations.module';
import { FriendsModule } from '@features/friends/friends.module';
import { MessageActionsController } from './message-actions.controller';
import { MessagesController } from './messages.controller';
import { MessagesRepository } from './repository/messages.repository';
import { DeleteMessageUsecase } from './usecase/delete-message.usecase';
import { EditMessageUsecase } from './usecase/edit-message.usecase';
import { ListMessagesUsecase } from './usecase/list-messages.usecase';
import { MarkConversationReadUsecase } from './usecase/mark-conversation-read.usecase';
import { SendMessageUsecase } from './usecase/send-message.usecase';

/**
 * Messages feature.
 *
 * Owns message reads, sends, edits, deletes, read cursors, and keyset
 * pagination. Conversation lookup and the direct-peer profile come from
 * `ConversationsModule`; block checks reuse `FriendsModule`.
 */
@Module({
  imports: [AuthModule, ConversationsModule, FriendsModule],
  controllers: [MessagesController, MessageActionsController],
  providers: [
    MessagesRepository,
    ListMessagesUsecase,
    SendMessageUsecase,
    EditMessageUsecase,
    DeleteMessageUsecase,
    MarkConversationReadUsecase,
  ],
})
export class MessagesModule {}
