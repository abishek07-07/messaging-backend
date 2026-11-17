import { Injectable } from '@nestjs/common';
import { UsersRepository } from '@features/auth/repository/users.repository';
import { ConversationsRepository } from '@features/conversations/repository/conversations.repository';
import { UserBlocksRepository } from '@features/friends/repository/user-blocks.repository';
import { failure, success, Usecase, Response } from '@utils/usecase/index';
import type { ContentEncoding } from '../repository/messages.entity';
import { MessagesRepository } from '../repository/messages.repository';
import {
  MessageResponse,
  toMessageResponse,
} from '../response/message.response';

/** Input for sending a message into a conversation. */
export interface SendMessageCommand {
  /** Public UUID of the authenticated caller. */
  actorPublicId: string;

  /** Public UUID of the target conversation. */
  conversationPublicId: string;

  /** Message text. */
  content: string;

  /** How `content` is encoded. Defaults to plaintext. */
  encoding?: ContentEncoding;

  /** Per-recipient wrapped session keys for `e2ee` messages. */
  cryptoMetadata?: Record<string, unknown>;

  /** Client-generated UUID for deduplication / optimistic sends. */
  clientMessageId?: string;

  /** Public UUID of the message being replied to. */
  replyToId?: string;
}

/**
 * Send a text message.
 *
 * Membership is checked before writing, direct conversations are blocked when
 * either side has blocked the other, and a repeated `clientMessageId` returns
 * the original message instead of inserting a duplicate.
 */
@Injectable()
export class SendMessageUsecase implements Usecase<
  SendMessageCommand,
  MessageResponse
> {
  constructor(
    private readonly users: UsersRepository,
    private readonly conversations: ConversationsRepository,
    private readonly messages: MessagesRepository,
    private readonly blocks: UserBlocksRepository,
  ) {}

  async execute(
    command: SendMessageCommand,
  ): Promise<Response<MessageResponse>> {
    const actor = await this.users.findByPublicId(command.actorPublicId);
    if (!actor || !actor.is_active) {
      return failure<MessageResponse>(
        'UNAUTHORIZED',
        'Unauthorized',
        'Your account could not be found',
      );
    }

    const conversation = await this.conversations.findByPublicId(
      command.conversationPublicId,
    );
    if (!conversation) {
      return failure<MessageResponse>(
        'CONVERSATION_NOT_FOUND',
        'Not Found',
        'Conversation not found',
      );
    }

    if (!(await this.conversations.isMember(conversation.id, actor.id))) {
      return failure<MessageResponse>(
        'CONVERSATION_NOT_FOUND',
        'Not Found',
        'Conversation not found',
      );
    }

    if (conversation.type === 'direct') {
      const otherId = await this.conversations.findOtherParticipantInternalId(
        conversation.id,
        actor.id,
      );
      if (otherId && (await this.blocks.existsBetween(actor.id, otherId))) {
        return failure<MessageResponse>(
          'USER_BLOCKED',
          'Forbidden',
          'You cannot message this user',
        );
      }
    }

    if (command.clientMessageId) {
      const existing = await this.messages.findBySenderAndClientId(
        actor.id,
        command.clientMessageId,
      );
      if (existing) {
        if (String(existing.conversation_id) !== String(conversation.id)) {
          return failure<MessageResponse>(
            'CLIENT_MESSAGE_ID_CONFLICT',
            'Conflict',
            'This client message id was already used in another conversation',
          );
        }

        const view = await this.messages.findViewById(existing.public_id);
        if (!view) {
          return failure<MessageResponse>(
            'MESSAGE_NOT_FOUND',
            'Not Found',
            'Message not found',
          );
        }
        return success(toMessageResponse(view, actor.id));
      }
    }

    let replyToId: string | null = null;
    if (command.replyToId) {
      const reply = await this.messages.findByPublicIdInConversation(
        command.replyToId,
        conversation.id,
      );
      if (!reply || reply.deleted_at) {
        return failure<MessageResponse>(
          'INVALID_REPLY_TARGET',
          'Bad Request',
          'You can only reply to a message in this conversation',
        );
      }
      replyToId = reply.id;
    }

    const content = command.content.trim();
    if (!content) {
      return failure<MessageResponse>(
        'VALIDATION_ERROR',
        'Bad Request',
        'Message content is required',
      );
    }

    const created = await this.messages.create({
      conversation_id: conversation.id,
      sender_id: actor.id,
      client_message_id: command.clientMessageId ?? null,
      type: 'text',
      content,
      encoding: command.encoding ?? 'plaintext',
      ...(command.cryptoMetadata
        ? { crypto_metadata: command.cryptoMetadata }
        : {}),
      reply_to_id: replyToId,
    });

    const view = await this.messages.findViewById(created.public_id);
    if (!view) {
      return failure<MessageResponse>(
        'INTERNAL_SERVER_ERROR',
        'Internal Server Error',
        'Message could not be loaded',
      );
    }

    return success(toMessageResponse(view, actor.id));
  }
}
