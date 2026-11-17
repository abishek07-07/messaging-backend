import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AppException } from '@core/filters/index';
import { ApiEndpoint } from '@utils/swagger/index';
import { isFailure } from '@utils/usecase/index';
import { UserLoginRequest } from './request/user-login.request';
import { UserLoginResponse } from './response/user-login.response';
import { UserRegisterRequest } from './request/user-register.request';
import { UserRegisterResponse } from './response/user-register.response';
import { UserLoginUsecase } from './usecase/user-login.usecase';
import { UserRegisterUsecase } from './usecase/user-register.usecase';

/** HTTP boundary for authentication. Thin: validate → usecase → map to HTTP. */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly userRegisterUsecase: UserRegisterUsecase,
    private readonly userLoginUsecase: UserLoginUsecase,
  ) {}

  /** Register a new account. */
  @Post('register')
  @ApiEndpoint('Register a new user', { auth: false })
  async register(
    @Body() body: UserRegisterRequest,
  ): Promise<UserRegisterResponse> {
    const result = await this.userRegisterUsecase.execute(body);
    if (isFailure(result)) {
      throw new AppException(result.error);
    }
    return result.data;
  }

  /** Log in and receive an access token. */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiEndpoint('Log in with email and password', { auth: false })
  async login(@Body() body: UserLoginRequest): Promise<UserLoginResponse> {
    const result = await this.userLoginUsecase.execute(body);
    if (isFailure(result)) {
      throw new AppException(result.error);
    }
    return result.data;
  }
}
