import { Injectable, Scope } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Inject } from '@nestjs/common';
import type { Logger } from 'winston';

/**
 * Application logging service — the single entry point for logs.
 *
 * Wraps a Winston {@link Logger} so features never import `winston` directly.
 * Use it (`LoggerService`-compatible) as a normal Nest logger, or bind a context
 * once and reuse:
 *
 * ```ts
 * constructor(private readonly logger: LoggingService) {
 *   this.logger.setContext(UserRegisterUsecase.name);
 * }
 *
 * this.logger.log('user registered', { userId: user.id });
 * this.logger.error('registration failed', error, { email: req.email });
 * ```
 */
@Injectable({ scope: Scope.DEFAULT })
export class LoggingService implements LoggerService {
  private context?: string;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  /** Set the default context (usually the class name) for subsequent logs. */
  setContext(context: string): this {
    this.context = context;
    return this;
  }

  /** Alias for {@link log}, matching Nest's `LoggerService.verbose`. */
  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  /** Standard informational log. */
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  /** Diagnostic log for development. */
  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  /** Non-fatal warning. */
  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  /**
   * Error log. Pass the `Error` (if any) as the second argument so its stack is
   * captured.
   */
  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  /** Create a child logger bound to a context without mutating this instance. */
  withContext(context: string): LoggingService {
    const child = Object.create(this) as LoggingService;
    Object.defineProperty(child, 'context', { value: context, writable: true });
    return child;
  }

  private write(level: string, message: unknown, params: unknown[]): void {
    const { context, meta, error } = this.splitParams(params);
    const stack =
      message instanceof Error ? message.stack : (error?.stack ?? undefined);

    this.logger.log({
      level,
      message: message instanceof Error ? message.message : String(message),
      context: context ?? this.context,
      ...(stack ? { stack } : {}),
      ...(meta ? { meta } : {}),
    });
  }

  /**
   * Nest's `LoggerService` passes the context as the last string argument and
   * metadata before it; an `Error` may be among them. Split them apart.
   */
  private splitParams(params: unknown[]): {
    context?: string;
    meta?: Record<string, unknown>;
    error?: Error;
  } {
    const rest = [...params];
    let context: string | undefined;
    let meta: Record<string, unknown> | undefined;
    let error: Error | undefined;

    const last = rest[rest.length - 1];
    if (typeof last === 'string') {
      context = rest.pop() as string;
    }

    const errorCandidate = rest.find(
      (param): param is Error => param instanceof Error,
    );
    if (errorCandidate) {
      error = errorCandidate;
    }

    const metaCandidate = rest[rest.length - 1];
    if (
      metaCandidate &&
      typeof metaCandidate === 'object' &&
      !(metaCandidate instanceof Error) &&
      !Array.isArray(metaCandidate)
    ) {
      meta = metaCandidate as Record<string, unknown>;
    }

    return { context, meta, error };
  }
}
