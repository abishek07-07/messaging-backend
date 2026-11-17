import { Injectable } from '@nestjs/common';
import { UsersRepository } from '@features/auth/repository/users.repository';
import {
  UserResponse,
  toUserResponse,
} from '@features/auth/response/user.response';
import { failure, success, Usecase, Response } from '@utils/usecase/index';

/** Input for updating the caller's profile. */
export interface UpdateProfileCommand {
  /** Public UUID of the authenticated caller. */
  actorPublicId: string;

  /** New display name, when supplied. */
  displayName?: string;

  /** New avatar URL; `null` removes the avatar. */
  avatarUrl?: string | null;

  /** Base64 X25519 public key published for end-to-end encryption. */
  publicKey?: string;
}

/** Update the fields a user is allowed to change on their own profile. */
@Injectable()
export class UpdateProfileUsecase implements Usecase<
  UpdateProfileCommand,
  UserResponse
> {
  constructor(private readonly users: UsersRepository) {}

  async execute(
    command: UpdateProfileCommand,
  ): Promise<Response<UserResponse>> {
    const actor = await this.users.findByPublicId(command.actorPublicId);
    if (!actor || !actor.is_active) {
      return failure<UserResponse>(
        'UNAUTHORIZED',
        'Unauthorized',
        'Your account could not be found',
      );
    }

    const updated = await this.users.updateProfile(actor.public_id, {
      display_name: command.displayName,
      avatar_url: command.avatarUrl,
      public_key: command.publicKey,
    });

    if (!updated) {
      return failure<UserResponse>(
        'USER_NOT_FOUND',
        'Not Found',
        'User not found',
      );
    }

    return success(toUserResponse(updated));
  }
}
