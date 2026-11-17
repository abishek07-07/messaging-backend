import { Injectable } from '@nestjs/common';
import { UsersRepository } from '@features/auth/repository/users.repository';
import { failure, success, Usecase, Response } from '@utils/usecase/index';
import {
  UserProfileResponse,
  toUserProfileResponse,
} from '../response/user-profile.response';

/** Input for resolving a user profile by public UUID. */
export interface GetUserCommand {
  /** Public UUID of the authenticated caller. */
  actorPublicId: string;

  /** Public UUID of the user to resolve. */
  targetPublicId: string;
}

/** Return a user's public profile by UUID; email only for the caller. */
@Injectable()
export class GetUserUsecase implements Usecase<
  GetUserCommand,
  UserProfileResponse
> {
  constructor(private readonly users: UsersRepository) {}

  async execute(
    command: GetUserCommand,
  ): Promise<Response<UserProfileResponse>> {
    const actor = await this.users.findByPublicId(command.actorPublicId);
    if (!actor || !actor.is_active) {
      return failure<UserProfileResponse>(
        'UNAUTHORIZED',
        'Unauthorized',
        'Your account could not be found',
      );
    }

    const target = await this.users.findByPublicId(command.targetPublicId);
    if (!target || !target.is_active) {
      return failure<UserProfileResponse>(
        'USER_NOT_FOUND',
        'Not Found',
        'User not found',
      );
    }

    return success(toUserProfileResponse(target, target.id === actor.id));
  }
}
