import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AppException } from '@core/filters/index';
import { JsonWebTokenService } from '@core/jsonwebtoken/jwt.service';
import type { JwtPayload } from '@core/jsonwebtoken/jwt.service';

/**
 * The authenticated caller attached to the request by {@link JwtAuthGuard}.
 *
 * `publicId` is the JWT subject (`sub`), which is always the user's public UUID
 * — never the internal numeric database id.
 */
export interface AuthenticatedUser {
  publicId: string;
  username?: string;
  email?: string;
}

/** Express request augmented with the authenticated user. */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Bearer-token guard backed by `core/jsonwebtoken`.
 *
 * Verifies the `Authorization: Bearer <token>` header, then attaches the
 * decoded caller to `request.user`. Missing, malformed, expired, or invalid
 * tokens all produce the same `UNAUTHORIZED` error so token state is never
 * leaked to clients.
 *
 * ```ts
 * @UseGuards(JwtAuthGuard)
 * @Get()
 * list(@CurrentUser() user: AuthenticatedUser) { … }
 * ```
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: JsonWebTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return this.reject();
    }

    try {
      const payload = this.tokens.verify<JwtPayload>(token);

      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        return this.reject();
      }

      request.user = {
        publicId: payload.sub,
        username:
          typeof payload.username === 'string' ? payload.username : undefined,
        email: typeof payload.email === 'string' ? payload.email : undefined,
      };

      return true;
    } catch {
      return this.reject();
    }
  }

  /** Throw the single canonical authentication failure. */
  private reject(): never {
    throw new AppException({
      message: 'A valid bearer access token is required',
      statusCode: 'UNAUTHORIZED',
      error: 'Unauthorized',
    });
  }
}
