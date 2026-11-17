import { Global, Module } from '@nestjs/common';
import { HashingService } from './index';

/**
 * Global password hashing.
 *
 * Exports {@link HashingService} app-wide so any provider can inject it without
 * importing this module. Register **once** in `AppModule`.
 */
@Global()
@Module({
  providers: [HashingService],
  exports: [HashingService],
})
export class HashingModule {}
