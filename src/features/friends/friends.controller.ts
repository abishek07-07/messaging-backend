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
import { BlockUserRequest } from './request/block-user.request';
import { UserIdParams } from './request/user-id.params';
import { BlockedUserListResponse } from './response/blocked-user-list.response';
import { BlockedUserResponse } from './response/blocked-user.response';
import { FriendListResponse } from './response/friend-list.response';
import { FriendResponse } from './response/friend.response';
import { BlockUserUsecase } from './usecase/block-user.usecase';
import { ListBlockedUsersUsecase } from './usecase/list-blocked-users.usecase';
import { ListFriendsUsecase } from './usecase/list-friends.usecase';
import { RemoveFriendUsecase } from './usecase/remove-friend.usecase';
import { UnblockUserUsecase } from './usecase/unblock-user.usecase';

/** HTTP boundary for accepted friends and blocked users. */
@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(
    private readonly listFriendsUsecase: ListFriendsUsecase,
    private readonly removeFriendUsecase: RemoveFriendUsecase,
    private readonly blockUserUsecase: BlockUserUsecase,
    private readonly unblockUserUsecase: UnblockUserUsecase,
    private readonly listBlockedUsersUsecase: ListBlockedUsersUsecase,
  ) {}

  /** List all accepted friends of the caller. */
  @Get()
  @ApiEndpoint('List all friends')
  async list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FriendListResponse> {
    const result = await this.listFriendsUsecase.execute({
      actorPublicId: user.publicId,
    });
    if (isFailure(result)) {
      throw new AppException(result.error);
    }
    return result.data;
  }

  /** List all users blocked by the caller. */
  @Get('blocked')
  @ApiEndpoint('List blocked users')
  async listBlocked(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BlockedUserListResponse> {
    const result = await this.listBlockedUsersUsecase.execute({
      actorPublicId: user.publicId,
    });
    if (isFailure(result)) {
      throw new AppException(result.error);
    }
    return result.data;
  }

  /** Block a user by their public UUID. */
  @Post('blocked')
  @ApiEndpoint('Block a user')
  async block(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: BlockUserRequest,
  ): Promise<BlockedUserResponse> {
    const result = await this.blockUserUsecase.execute({
      actorPublicId: user.publicId,
      targetPublicId: body.userId,
    });
    if (isFailure(result)) {
      throw new AppException(result.error);
    }
    return result.data;
  }

  /** Unblock a user by their public UUID. */
  @Delete('blocked/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiEndpoint('Unblock a user')
  async unblock(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: UserIdParams,
  ): Promise<BlockedUserResponse> {
    const result = await this.unblockUserUsecase.execute({
      actorPublicId: user.publicId,
      targetPublicId: params.userId,
    });
    if (isFailure(result)) {
      throw new AppException(result.error);
    }
    return result.data;
  }

  /** Remove an accepted friend by their public UUID. */
  @Delete(':userId')
  @HttpCode(HttpStatus.OK)
  @ApiEndpoint('Remove a friend')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: UserIdParams,
  ): Promise<FriendResponse> {
    const result = await this.removeFriendUsecase.execute({
      actorPublicId: user.publicId,
      friendPublicId: params.userId,
    });
    if (isFailure(result)) {
      throw new AppException(result.error);
    }
    return result.data;
  }
}
