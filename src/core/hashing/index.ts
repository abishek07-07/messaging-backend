import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

/** Fallback cost factor if config is unavailable (10–12 suits interactive logins). */
const DEFAULT_ROUNDS = 10;

/**
 * Feature-agnostic password hashing built on `bcryptjs`.
 *
 * Features inject this service instead of importing `bcryptjs` directly, so the
 * hashing algorithm and cost live in one place. The cost factor comes from the
 * typed `hashing` config namespace (`HASH_ROUNDS`), never from `process.env`.
 * All methods are async and run on bcrypt's own thread pool, so they never
 * block the event loop.
 */
@Injectable()
export class HashingService {
  private readonly defaultRounds: number;

  constructor(private readonly config: ConfigService) {
    this.defaultRounds =
      this.config.get<number>('hashing.rounds') ?? DEFAULT_ROUNDS;
  }

  /**
   * Hash a plaintext value (e.g. a password) into a salted bcrypt hash.
   *
   * ```ts
   * const passwordHash = await hashing.hash(request.password);
   * ```
   */
  hash(value: string, rounds: number = this.defaultRounds): Promise<string> {
    return bcrypt.hash(value, rounds);
  }

  /**
   * Verify a plaintext value against a previously produced hash.
   * Returns `true` on match, `false` otherwise. Never throws on mismatch.
   *
   * ```ts
   * const ok = await hashing.verify(request.password, user.passwordHash);
   * ```
   */
  verify(value: string, hash: string): Promise<boolean> {
    return bcrypt.compare(value, hash);
  }

  /** Generate a salt for a given number of rounds. */
  genSalt(rounds: number = this.defaultRounds): Promise<string> {
    return bcrypt.genSalt(rounds);
  }

  /** Return the number of rounds used to produce a given hash. */
  getRounds(hash: string): number {
    return bcrypt.getRounds(hash);
  }
}
