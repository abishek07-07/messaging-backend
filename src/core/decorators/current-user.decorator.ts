import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AppException } from '@core/filters/index';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '@core/guards/jwt-auth.guard';

/**
 * Inject the caller authenticated by {@link JwtAuthGuard}.
 *
 * ```ts
 * @UseGuards(JwtAuthGuard)
 * @Get()
 * list(@CurrentUser() user: AuthenticatedUser) { … }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new AppException({
        message: 'A valid bearer access token is required',
        statusCode: 'UNAUTHORIZED',
        error: 'Unauthorized',
      });
    }

    return request.user;
  },
);
