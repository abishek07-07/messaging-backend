import { Injectable } from '@nestjs/common';
import { UsersRepository } from '@features/auth/repository/users.repository';
import {
  UserResponse,
  toUserResponse,
} from '@features/auth/response/user.response';
import { failure, success, Usecase, Response } from '@utils/usecase/index';

/** Input for reading the authenticated user's own profile. */
export interface GetMeCommand {
  /** Public UUID of the authenticated caller. */
  actorPublicId: string;
}

/** Return the caller's own profile. */
@Injectable()
export class GetMeUsecase implements Usecase<GetMeCommand, UserResponse> {
  constructor(private readonly users: UsersRepository) {}

  async execute(command: GetMeCommand): Promise<Response<UserResponse>> {
    const actor = await this.users.findByPublicId(command.actorPublicId);
    if (!actor || !actor.is_active) {
      return failure<UserResponse>(
        'UNAUTHORIZED',
        'Unauthorized',
        'Your account could not be found',
      );
    }

    return success(toUserResponse(actor));
  }
}
