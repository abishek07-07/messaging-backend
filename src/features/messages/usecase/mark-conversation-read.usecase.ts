import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { UsersRepository } from '@features/auth/repository/users.repository';
import { ConversationsRepository } from '@features/conversations/repository/conversations.repository';
import { failure, success, Usecase, Response } from '@utils/usecase/index';
import type { MessageEntity } from '../repository/messages.entity';
import { MessagesRepository } from '../repository/messages.repository';
import { MarkReadResponse } from '../response/mark-read.response';

/** Input for advancing the read cursor in a conversation. */
export interface MarkConversationReadCommand {
  /** Public UUID of the authenticated caller. */
  actorPublicId: string;

  /** Public UUID of the conversation. */
  conversationPublicId: string;

  /** Newest message the caller has seen; omit for the latest message. */
  messageId?: string;
}

/** Mark a conversation as read up to a message and return the unread count. */
@Injectable()
export class MarkConversationReadUsecase implements Usecase<
  MarkConversationReadCommand,
  MarkReadResponse
> {
  constructor(
    private readonly users: UsersRepository,
    private readonly conversations: ConversationsRepository,
    private readonly messages: MessagesRepository,
  ) {}

  async execute(
    command: MarkConversationReadCommand,
  ): Promise<Response<MarkReadResponse>> {
    const actor = await this.users.findByPublicId(command.actorPublicId);
    if (!actor || !actor.is_active) {
      return failure<MarkReadResponse>(
        'UNAUTHORIZED',
        'Unauthorized',
        'Your account could not be found',
      );
    }

    const conversation = await this.conversations.findByPublicId(
      command.conversationPublicId,
    );
    if (!conversation) {
      return failure<MarkReadResponse>(
        'CONVERSATION_NOT_FOUND',
        'Not Found',
        'Conversation not found',
      );
    }

    if (!(await this.conversations.isMember(conversation.id, actor.id))) {
      return failure<MarkReadResponse>(
        'CONVERSATION_NOT_FOUND',
        'Not Found',
        'Conversation not found',
      );
    }

    let target: MessageEntity | null;
    if (command.messageId) {
      target = await this.messages.findByPublicIdInConversation(
        command.messageId,
        conversation.id,
      );
      if (!target) {
        return failure<MarkReadResponse>(
          'MESSAGE_NOT_FOUND',
          'Not Found',
          'Message not found',
        );
      }
    } else {
      target = await this.messages.findLatestByConversation(conversation.id);
    }

    if (!target) {
      return success(
        plainToInstance(
          MarkReadResponse,
          { unreadCount: 0 },
          { excludeExtraneousValues: true },
        ),
      );
    }

    await this.messages.markRead(conversation.id, actor.id, target.id);
    const unreadCount = await this.messages.countUnread(
      conversation.id,
      actor.id,
    );

    return success(
      plainToInstance(
        MarkReadResponse,
        { unreadCount },
        { excludeExtraneousValues: true },
      ),
    );
  }
}
