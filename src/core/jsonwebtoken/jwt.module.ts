import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { JsonWebTokenService } from './jwt.service';

/**
 * Registers the JWT infrastructure for the whole app.
 *
 * Marked `global: true` so features can inject {@link JsonWebTokenService}
 * without importing this module explicitly. Options are read from the typed
 * `jwtConfig` namespace via {@link ConfigService} — never from `process.env`
 * directly — so validation and defaults live in `core/config`.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: config.get<string>(
            'jwt.expiresIn',
          ) as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  providers: [JsonWebTokenService],
  exports: [JsonWebTokenService, JwtModule],
})
export class JsonWebTokenModule {}
