import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { UsersRepository } from './repository/users.repository';
import { UserLoginUsecase } from './usecase/user-login.usecase';
import { UserRegisterUsecase } from './usecase/user-register.usecase';
import { JsonWebTokenModule } from '@core/jsonwebtoken/jwt.module';

/**
 * Authentication feature.
 *
 * `DatabaseModule`, `HashingModule` and `JsonWebTokenModule` are global, so the
 * repository and usecases inject their dependencies without extra imports.
 */
@Module({
  imports: [JsonWebTokenModule],
  controllers: [AuthController],
  providers: [UserRegisterUsecase, UserLoginUsecase, UsersRepository],
  exports: [UsersRepository],
})
export class AuthModule {}
