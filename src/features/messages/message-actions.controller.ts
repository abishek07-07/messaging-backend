import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@core/decorators/index';
import { AppException } from '@core/filters/index';
import { JwtAuthGuard } from '@core/guards/index';
import type { AuthenticatedUser } from '@core/guards/index';
import { ApiEndpoint } from '@utils/swagger/index';
import { isFailure } from '@utils/usecase/index';
import { EditMessageRequest } from './request/edit-message.request';
import { MessageIdParams } from './request/message-id.params';
import { MessageResponse } from './response/message.response';
import { DeleteMessageUsecase } from './usecase/delete-message.usecase';
import { EditMessageUsecase } from './usecase/edit-message.usecase';

/** HTTP boundary for actions scoped to a single message. */
@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessageActionsController {
  constructor(
    private readonly editMessageUsecase: EditMessageUsecase,
    private readonly deleteMessageUsecase: DeleteMessageUsecase,
  ) {}

  /** Edit one of the caller's own text messages. */
  @Patch(':messageId')
  @ApiEndpoint('Edit a message')
  async edit(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: MessageIdParams,
    @Body() body: EditMessageRequest,
  ): Promise<MessageResponse> {
    const result = await this.editMessageUsecase.execute({
      actorPublicId: user.publicId,
      messagePublicId: params.messageId,
      content: body.content,
      encoding: body.encoding,
      cryptoMetadata: body.cryptoMetadata,
    });
    if (isFailure(result)) {
      throw new AppException(result.error);
    }
    return result.data;
  }

  /** Soft-delete one of the caller's own messages. */
  @Delete(':messageId')
  @HttpCode(HttpStatus.OK)
  @ApiEndpoint('Delete a message')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: MessageIdParams,
  ): Promise<MessageResponse> {
    const result = await this.deleteMessageUsecase.execute({
      actorPublicId: user.publicId,
      messagePublicId: params.messageId,
    });
    if (isFailure(result)) {
      throw new AppException(result.error);
    }
    return result.data;
  }
}
