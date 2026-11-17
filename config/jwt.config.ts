import { registerAs } from '@nestjs/config';

/** Token used to inject the JWT config: `@Inject(jwtConfig.KEY)`. */
export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET ?? 'development-secret-change-me',
  expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
}));
