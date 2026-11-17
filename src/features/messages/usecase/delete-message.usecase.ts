import { Injectable } from '@nestjs/common';
import { UsersRepository } from '@features/auth/repository/users.repository';
import { ConversationsRepository } from '@features/conversations/repository/conversations.repository';
import { failure, success, Usecase, Response } from '@utils/usecase/index';
import { MessagesRepository } from '../repository/messages.repository';
import {
  MessageResponse,
  toMessageResponse,
} from '../response/message.response';

/** Input for deleting a message. */
export interface DeleteMessageCommand {
  /** Public UUID of the authenticated caller. */
  actorPublicId: string;

  /** Public UUID of the message to delete. */
  messagePublicId: string;
}

/** Soft-delete one of the caller's own messages. */
@Injectable()
export class DeleteMessageUsecase implements Usecase<
  DeleteMessageCommand,
  MessageResponse
> {
  constructor(
    private readonly users: UsersRepository,
    private readonly conversations: ConversationsRepository,
    private readonly messages: MessagesRepository,
  ) {}

  async execute(
    command: DeleteMessageCommand,
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
        'You can only delete your own messages',
      );
    }

    if (!message.deleted_at) {
      await this.messages.softDelete(command.messagePublicId);
    }

    const view = await this.messages.findViewById(command.messagePublicId);
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
