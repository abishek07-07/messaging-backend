import { Injectable } from '@nestjs/common';
import { UsersRepository } from '@features/auth/repository/users.repository';
import { ConversationsRepository } from '@features/conversations/repository/conversations.repository';
import { failure, success, Usecase, Response } from '@utils/usecase/index';
import type { ContentEncoding } from '../repository/messages.entity';
import { MessagesRepository } from '../repository/messages.repository';
import {
  MessageResponse,
  toMessageResponse,
} from '../response/message.response';

/** Input for editing a message. */
export interface EditMessageCommand {
  /** Public UUID of the authenticated caller. */
  actorPublicId: string;

  /** Public UUID of the message to edit. */
  messagePublicId: string;

  /** Replacement text. */
  content: string;

  /** How `content` is encoded. Defaults to plaintext. */
  encoding?: ContentEncoding;

  /** Per-recipient wrapped session keys for `e2ee` messages. */
  cryptoMetadata?: Record<string, unknown>;
}

/** Edit one of the caller's own text messages. */
@Injectable()
export class EditMessageUsecase implements Usecase<
  EditMessageCommand,
  MessageResponse
> {
  constructor(
    private readonly users: UsersRepository,
    private readonly conversations: ConversationsRepository,
    private readonly messages: MessagesRepository,
  ) {}

  async execute(
    command: EditMessageCommand,
  ): Promise<Response<MessageResponse>> {
    const actor = await this.users.findByPublicId(command.actorPublicId);
    if (!actor || !actor.is_active) {
      return failure<MessageResponse>(
        'UNAUTHORIZED',
        'Unauthorized',
        'Your account could not be found',
      );
    }

    const message = await this.messages.findByPublicId(command.messagePublicId);
    if (
      !message ||
      !(await this.conversations.isMember(message.conversation_id, actor.id))
    ) {
      return failure<MessageResponse>(
        'MESSAGE_NOT_FOUND',
        'Not Found',
        'Message not found',
      );
    }

    if (String(message.sender_id) !== String(actor.id)) {
      return failure<MessageResponse>(
        'FORBIDDEN',
        'Forbidden',
        'You can only edit your own messages',
      );
    }

    if (message.deleted_at) {
      return failure<MessageResponse>(
        'MESSAGE_DELETED',
        'Conflict',
        'Deleted messages cannot be edited',
      );
    }

    if (message.type !== 'text') {
      return failure<MessageResponse>(
        'UNSUPPORTED_MESSAGE_TYPE',
        'Bad Request',
        'Only text messages can be edited',
      );
    }

    const content = command.content.trim();
    if (!content) {
      return failure<MessageResponse>(
        'VALIDATION_ERROR',
        'Bad Request',
        'Message content is required',
      );
    }

    const updated =
      command.encoding === undefined && command.cryptoMetadata === undefined
        ? await this.messages.updateContent(command.messagePublicId, content)
        : await this.messages.updateContent(
            command.messagePublicId,
            content,
            command.encoding,
            command.cryptoMetadata,
          );
    if (!updated) {
      return failure<MessageResponse>(
        'MESSAGE_DELETED',
        'Conflict',
        'Deleted messages cannot be edited',
      );
    }

    const view = await this.messages.findViewById(updated.public_id);
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
