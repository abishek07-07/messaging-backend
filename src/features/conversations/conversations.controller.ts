import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@core/decorators/index';
import { AppException } from '@core/filters/index';
import { JwtAuthGuard } from '@core/guards/index';
import type { AuthenticatedUser } from '@core/guards/index';
import { ApiEndpoint } from '@utils/swagger/index';
import { isFailure } from '@utils/usecase/index';
import { ConversationListResponse } from './response/conversation-list.response';
import { ListConversationsUsecase } from './usecase/list-conversations.usecase';

/** HTTP boundary for the per-friend chat list. */
@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(
    private readonly listConversationsUsecase: ListConversationsUsecase,
  ) {}

  /** Chat list: friend, conversation id, and latest message per friend. */
  @Get()
  @ApiEndpoint('List conversations with accepted friends')
  async list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConversationListResponse> {
    const result = await this.listConversationsUsecase.execute({
      actorPublicId: user.publicId,
    });
    if (isFailure(result)) {
      throw new AppException(result.error);
    }
    return result.data;
  }
}
