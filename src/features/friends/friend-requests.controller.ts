import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@core/decorators/index';
import { AppException } from '@core/filters/index';
import { JwtAuthGuard } from '@core/guards/index';
import type { AuthenticatedUser } from '@core/guards/index';
import { ApiEndpoint } from '@utils/swagger/index';
import { isFailure } from '@utils/usecase/index';
import { FriendRequestIdParams } from './request/friend-request-id.params';
import { SendFriendRequestRequest } from './request/send-friend-request.request';
import { FriendRequestListResponse } from './response/friend-request-list.response';
import { FriendRequestResponse } from './response/friend-request.response';
import { AcceptFriendRequestUsecase } from './usecase/accept-friend-request.usecase';
import { CancelFriendRequestUsecase } from './usecase/cancel-friend-request.usecase';
import { DeclineFriendRequestUsecase } from './usecase/decline-friend-request.usecase';
import { ListFriendRequestsUsecase } from './usecase/list-friend-requests.usecase';
import { SendFriendRequestUsecase } from './usecase/send-friend-request.usecase';

/** HTTP boundary for friend requests. Thin: validate → usecase → map to HTTP. */
@Controller('friend-requests')
@UseGuards(JwtAuthGuard)
export class FriendRequestsController {
  constructor(
    private readonly sendFriendRequestUsecase: SendFriendRequestUsecase,
    private readonly listFriendRequestsUsecase: ListFriendRequestsUsecase,
    private readonly acceptFriendRequestUsecase: AcceptFriendRequestUsecase,
    private readonly declineFriendRequestUsecase: DeclineFriendRequestUsecase,
    private readonly cancelFriendRequestUsecase: CancelFriendRequestUsecase,
  ) {}

  /** Send a friend request to the user with the given public UUID. */
  @Post()
  @ApiEndpoint('Send a friend request')
  async send(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SendFriendRequestRequest,
  ): Promise<FriendRequestResponse> {
    const result = await this.sendFriendRequestUsecase.execute({
      actorPublicId: user.publicId,
      recipientPublicId: body.userId,
    });
    if (isFailure(result)) {
      throw new AppException(result.error);
    }
    return result.data;
  }

  /** List incoming and outgoing pending friend requests. */
  @Get()
  @ApiEndpoint('List incoming and outgoing friend requests')
  async list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FriendRequestListResponse> {
    const result = await this.listFriendRequestsUsecase.execute({
      actorPublicId: user.publicId,
    });
    if (isFailure(result)) {
      throw new AppException(result.error);
    }
    return result.data;
  }

  /** Accept a pending friend request addressed to the caller. */
  @Post(':requestId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiEndpoint('Accept a friend request')
  async accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: FriendRequestIdParams,
  ): Promise<FriendRequestResponse> {
    const result = await this.acceptFriendRequestUsecase.execute({
      actorPublicId: user.publicId,
      requestPublicId: params.requestId,
    });
    if (isFailure(result)) {
      throw new AppException(result.error);
    }
    return result.data;
  }

  /** Decline a pending friend request addressed to the caller. */
  @Post(':requestId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiEndpoint('Reject a friend request')
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: FriendRequestIdParams,
  ): Promise<FriendRequestResponse> {
    const result = await this.declineFriendRequestUsecase.execute({
      actorPublicId: user.publicId,
      requestPublicId: params.requestId,
    });
    if (isFailure(result)) {
      throw new AppException(result.error);
    }
    return result.data;
  }

  /** Cancel a friend request the caller previously sent. */
  @Delete(':requestId')
  @HttpCode(HttpStatus.OK)
  @ApiEndpoint('Cancel a sent friend request')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: FriendRequestIdParams,
  ): Promise<FriendRequestResponse> {
    const result = await this.cancelFriendRequestUsecase.execute({
      actorPublicId: user.publicId,
      requestPublicId: params.requestId,
    });
    if (isFailure(result)) {
      throw new AppException(result.error);
    }
    return result.data;
  }
}
