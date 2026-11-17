import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@core/decorators/index';
import { AppException } from '@core/filters/index';
import { JwtAuthGuard } from '@core/guards/index';
import type { AuthenticatedUser } from '@core/guards/index';
import { ApiEndpoint } from '@utils/swagger/index';
import { isFailure } from '@utils/usecase/index';
import { ConversationIdParams } from './request/conversation-id.params';
import { ListMessagesQuery } from './request/list-messages.query';
import { MarkReadRequest } from './request/mark-read.request';
import { SendMessageRequest } from './request/send-message.request';
import { MessageListResponse } from './response/message-list.response';
import { MarkReadResponse } from './response/mark-read.response';
import { MessageResponse } from './response/message.response';
import { ListMessagesUsecase } from './usecase/list-messages.usecase';
import { MarkConversationReadUsecase } from './usecase/mark-conversation-read.usecase';
import { SendMessageUsecase } from './usecase/send-message.usecase';

/** HTTP boundary for reading and writing a conversation's messages. */
@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(
    private readonly listMessagesUsecase: ListMessagesUsecase,
    private readonly sendMessageUsecase: SendMessageUsecase,
    private readonly markConversationReadUsecase: MarkConversationReadUsecase,
  ) {}

  /**
   * Latest page by default; pass `cursor=<oldest loaded message id>` to page
   * backwards through history.
   */
  @Get(':conversationId/messages')
  @ApiEndpoint('List messages in a conversation (cursor paginated)')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ConversationIdParams,
    @Query() query: ListMessagesQuery,
  ): Promise<MessageListResponse> {
    const result = await this.listMessagesUsecase.execute({
      actorPublicId: user.publicId,
      conversationPublicId: params.conversationId,
      cursor: query.cursor,
      limit: query.limit,
    });
    if (isFailure(result)) {
      throw new AppException(result.error);
    }
    return result.data;
  }

  /** Send a text message into the conversation. */
  @Post(':conversationId/messages')
  @ApiEndpoint('Send a message')
  async send(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ConversationIdParams,
    @Body() body: SendMessageRequest,
  ): Promise<MessageResponse> {
    const result = await this.sendMessageUsecase.execute({
      actorPublicId: user.publicId,
      conversationPublicId: params.conversationId,
      content: body.content,
      encoding: body.encoding,
      cryptoMetadata: body.cryptoMetadata,
      clientMessageId: body.clientMessageId,
      replyToId: body.replyToId,
    });
    if (isFailure(result)) {
      throw new AppException(result.error);
    }
    return result.data;
  }

  /** Advance the caller's read cursor and return the remaining unread count. */
  @Post(':conversationId/read')
  @HttpCode(HttpStatus.OK)
  @ApiEndpoint('Mark a conversation as read')
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ConversationIdParams,
    @Body() body: MarkReadRequest,
  ): Promise<MarkReadResponse> {
    const result = await this.markConversationReadUsecase.execute({
      actorPublicId: user.publicId,
      conversationPublicId: params.conversationId,
      messageId: body.messageId,
    });
    if (isFailure(result)) {
      throw new AppException(result.error);
    }
    return result.data;
  }
}
