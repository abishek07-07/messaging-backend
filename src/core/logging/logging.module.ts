import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { createLoggerOptions } from './logger.config';
import { LoggingService } from './logging.service';

/**
 * Global logging, powered by Winston.
 *
 * Registers the Winston transports (console + `logs/combined.log` +
 * `logs/error.log`) and exports {@link LoggingService} app-wide, so any provider
 * can inject it without importing this module. Options come from the typed
 * `logging` config namespace.
 */
@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createLoggerOptions(config),
    }),
  ],
  providers: [LoggingService],
  exports: [LoggingService, WinstonModule],
})
export class LoggingModule {}
