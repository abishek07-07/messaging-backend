import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions, JwtVerifyOptions } from '@nestjs/jwt';

/**
 * Decode options, re-declared locally so this module does not depend on a
 * direct `jsonwebtoken` install.
 */
export interface JwtDecodeOptions {
  /** Return the full token (`header`, `payload`, `signature`) instead of just the payload. */
  complete?: boolean;
  /** Return the header and payload even if the signature is invalid. */
  json?: boolean;
}

/** A decoded JWT payload. Extend this in a feature to type known claims. */
export interface JwtPayload {
  /** Subject — usually the user id. */
  sub?: string;
  /** Issued-at, seconds since epoch. */
  iat?: number;
  /** Expiry, seconds since epoch. */
  exp?: number;
  /** Any additional claims. */
  [claim: string]: unknown;
}

/**
 * Feature-agnostic wrapper around `@nestjs/jwt`.
 *
 * Features depend on this service instead of `@nestjs/jwt` directly, so the
 * token strategy (secret, algorithm, TTLs) lives in one place and can change
 * without touching business logic.
 */
@Injectable()
export class JsonWebTokenService {
  constructor(private readonly jwtService: JwtService) {}

  /**
   * Sign a payload into a JWT, using the module's default options.
   *
   * ```ts
   * const token = tokens.signIn({ sub: user.id });
   * ```
   */
  signIn(payload: string | Buffer | JwtPayload): string {
    return this.jwtService.sign(payload as object);
  }

  /**
   * Sign a payload with per-call options, overriding the defaults
   * (e.g. a different `expiresIn`, `secret`, or `algorithm`).
   */
  signInWithOptions(
    payload: string | Buffer | JwtPayload,
    options: JwtSignOptions,
  ): string {
    return this.jwtService.sign(payload as object, options);
  }

  /**
   * Verify a token's signature and claims, returning the decoded payload.
   * Throws if the token is malformed, expired, or has an invalid signature.
   */
  verify<T extends JwtPayload = JwtPayload>(
    token: string,
    options?: JwtVerifyOptions,
  ): T {
    return this.jwtService.verify<T>(token, options);
  }

  /**
   * Decode a token **without** verifying it. Useful for reading claims from an
   * expired token or inspecting a token before deciding whether to trust it.
   * Never use the result for authorization on its own.
   */
  decode<T = JwtPayload>(token: string): T | null {
    return this.jwtService.decode<T>(token);
  }

  /**
   * Decode a token with per-call options. Pass `{ complete: true }` to receive
   * the full token (header + payload + signature) instead of just the payload.
   */
  decodeWithOptions<T = JwtPayload>(
    token: string,
    options: JwtDecodeOptions = {},
  ): T | null {
    return this.jwtService.decode<T>(token, options);
  }
}
