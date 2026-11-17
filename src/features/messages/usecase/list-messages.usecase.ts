import { Injectable } from '@nestjs/common';
import { UsersRepository } from '@features/auth/repository/users.repository';
import { failure, success, Usecase, Response } from '@utils/usecase/index';
import { ConversationsRepository } from '@features/conversations/repository/conversations.repository';
import type { MessageCursor } from '../repository/messages.repository';
import { MessagesRepository } from '../repository/messages.repository';
import {
  MessageListResponse,
  toMessageListResponse,
} from '../response/message-list.response';

/** Default number of messages returned per page. */
const DEFAULT_PAGE_SIZE = 10;

/** Input for reading a conversation's messages. */
export interface ListMessagesCommand {
  /** Public UUID of the authenticated caller. */
  actorPublicId: string;

  /** Public UUID of the conversation to read. */
  conversationPublicId: string;

  /**
   * Public UUID of the oldest message the client already has. Omit it for the
   * newest page; pass `nextCursor` from the previous page for older messages.
   */
  cursor?: string;

  /** Page size (default 10, max 50 — enforced by the request DTO). */
  limit?: number;
}

/**
 * Read one page of conversation messages, newest page first.
 *
 * Guards membership before touching messages, validates that the cursor is a
 * message in this conversation, and returns the page in reading order
 * (oldest → newest) together with the other participant's profile.
 */
@Injectable()
export class ListMessagesUsecase implements Usecase<
  ListMessagesCommand,
  MessageListResponse
> {
  constructor(
    private readonly users: UsersRepository,
    private readonly conversations: ConversationsRepository,
    private readonly messages: MessagesRepository,
  ) {}

  async execute(
    command: ListMessagesCommand,
  ): Promise<Response<MessageListResponse>> {
    const actor = await this.users.findByPublicId(command.actorPublicId);
    if (!actor || !actor.is_active) {
      return failure<MessageListResponse>(
        'UNAUTHORIZED',
        'Unauthorized',
        'Your account could not be found',
      );
    }

    const conversation = await this.conversations.findByPublicId(
      command.conversationPublicId,
    );
    if (!conversation) {
      return failure<MessageListResponse>(
        'CONVERSATION_NOT_FOUND',
        'Not Found',
        'Conversation not found',
      );
    }

    // Non-members get the same 404 as a missing conversation so conversation
    // ids cannot be probed.
    if (!(await this.conversations.isMember(conversation.id, actor.id))) {
      return failure<MessageListResponse>(
        'CONVERSATION_NOT_FOUND',
        'Not Found',
        'Conversation not found',
      );
    }

    let before: MessageCursor | undefined;
    if (command.cursor) {
      const cursorMessage = await this.messages.findByPublicIdInConversation(
        command.cursor,
        conversation.id,
      );
      if (!cursorMessage) {
        return failure<MessageListResponse>(
          'INVALID_CURSOR',
          'Bad Request',
          'The pagination cursor is not a message in this conversation',
        );
      }

      before = {
        created_at: cursorMessage.created_at,
        id: cursorMessage.id,
      };
    }

    const page = await this.messages.listByConversation(
      conversation.id,
      command.limit ?? DEFAULT_PAGE_SIZE,
      before,
    );

    const otherParticipant =
      conversation.type === 'direct'
        ? await this.conversations.findOtherParticipant(
            conversation.id,
            actor.id,
          )
        : null;

    // The page is oldest → newest, so its first message is the cursor for the
    // next (older) page.
    const nextCursor =
      page.hasMore && page.messages.length > 0
        ? page.messages[0].message.public_id
        : null;

    return success(
      toMessageListResponse(
        conversation,
        otherParticipant,
        page,
        actor.id,
        nextCursor,
      ),
    );
  }
}
