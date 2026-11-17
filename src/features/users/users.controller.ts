import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@core/decorators/index';
import { AppException } from '@core/filters/index';
import { JwtAuthGuard } from '@core/guards/index';
import type { AuthenticatedUser } from '@core/guards/index';
import { UserResponse } from '@features/auth/response/user.response';
import { ApiEndpoint } from '@utils/swagger/index';
import { isFailure } from '@utils/usecase/index';
import { SearchUsersQuery } from './request/search-users.query';
import { UpdateProfileRequest } from './request/update-profile.request';
import { UserIdParams } from './request/user-id.params';
import { UserProfileResponse } from './response/user-profile.response';
import { UserSearchResponse } from './response/user-summary.response';
import { GetMeUsecase } from './usecase/get-me.usecase';
import { GetUserUsecase } from './usecase/get-user.usecase';
import { SearchUsersUsecase } from './usecase/search-users.usecase';
import { UpdateProfileUsecase } from './usecase/update-profile.usecase';

/** HTTP boundary for user discovery and the caller's own profile. */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly searchUsersUsecase: SearchUsersUsecase,
    private readonly getMeUsecase: GetMeUsecase,
    private readonly getUserUsecase: GetUserUsecase,
    private readonly updateProfileUsecase: UpdateProfileUsecase,
  ) {}

  /** Search active users by username or display name. */
  @Get()
  @ApiEndpoint('Search users by username or display name')
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SearchUsersQuery,
  ): Promise<UserSearchResponse> {
    const result = await this.searchUsersUsecase.execute({
      actorPublicId: user.publicId,
      search: query.search,
      limit: query.limit,
    });
    if (isFailure(result)) {
      throw new AppException(result.error);
    }
    return result.data;
  }

  /** Return the authenticated user's profile. */
  @Get('me')
  @ApiEndpoint('Get the current user profile')
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserResponse> {
    const result = await this.getMeUsecase.execute({
      actorPublicId: user.publicId,
    });
    if (isFailure(result)) {
      throw new AppException(result.error);
    }
    return result.data;
  }

  /** Return a user's public profile by their UUID. */
  @Get(':userId')
  @ApiEndpoint('Get a user profile by UUID')
  async getUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: UserIdParams,
  ): Promise<UserProfileResponse> {
    const result = await this.getUserUsecase.execute({
      actorPublicId: user.publicId,
      targetPublicId: params.userId,
    });
    if (isFailure(result)) {
      throw new AppException(result.error);
    }
    return result.data;
  }

  /** Update display name and/or avatar URL. */
  @Patch('me')
  @ApiEndpoint('Update the current user profile')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateProfileRequest,
  ): Promise<UserResponse> {
    const result = await this.updateProfileUsecase.execute({
      actorPublicId: user.publicId,
      displayName: body.displayName,
      avatarUrl: body.avatarUrl,
      publicKey: body.publicKey,
    });
    if (isFailure(result)) {
      throw new AppException(result.error);
    }
    return result.data;
  }
}
