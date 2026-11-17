import { Module } from '@nestjs/common';
import { AuthModule } from '@features/auth/auth.module';
import { UsersController } from './users.controller';
import { GetMeUsecase } from './usecase/get-me.usecase';
import { GetUserUsecase } from './usecase/get-user.usecase';
import { SearchUsersUsecase } from './usecase/search-users.usecase';
import { UpdateProfileUsecase } from './usecase/update-profile.usecase';

/** User discovery and self-profile feature. */
@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [
    SearchUsersUsecase,
    GetMeUsecase,
    GetUserUsecase,
    UpdateProfileUsecase,
  ],
})
export class UsersModule {}
