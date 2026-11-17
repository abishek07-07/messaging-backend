import { registerAs } from '@nestjs/config';

/** Token used to inject the hashing config: `@Inject(hashingConfig.KEY)`. */
export const hashingConfig = registerAs('hashing', () => ({
  rounds: parseInt(process.env.HASH_ROUNDS ?? '10', 10),
}));
