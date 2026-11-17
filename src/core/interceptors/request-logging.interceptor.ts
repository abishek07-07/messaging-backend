import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { catchError, Observable, tap, throwError } from 'rxjs';
import type { Request, Response } from 'express';
import { LoggingService } from '../logging/logging.service';

/**
 * Logs every incoming HTTP request and its outcome.
 *
 * Records method, url, status, duration, and — when `logging.logRequests` is
 * enabled (development, `LOG_REQUESTS=true`) — the request body, query, and
 * params. In production the flag is off, so bodies and secrets never reach the
 * log files.
 *
 * This is the enforcement of the rule: *in development, request data is logged*.
 */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger: LoggingService;
  private readonly logRequests: boolean;

  constructor(logger: LoggingService, config: ConfigService) {
    this.logger = logger.withContext(RequestLoggingInterceptor.name);
    this.logRequests = config.get<boolean>('logging.logRequests') ?? false;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Only HTTP requests are logged; skip other transports (rpc, ws…).
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const { method, originalUrl } = request;
    const startedAt = Date.now();

    if (this.logRequests) {
      const requestMeta: Record<string, unknown> = {
        ip: request.ip,
        body: request.body,
        query: request.query,
        params: request.params,
      };
      this.logger.debug(`${method} ${originalUrl} request`, requestMeta);
    }

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - startedAt;
        this.logger.log(
          `${method} ${originalUrl} ${response.statusCode} ${ms}ms`,
        );
      }),
      catchError((error: unknown) => {
        const ms = Date.now() - startedAt;
        this.logger.error(
          `${method} ${originalUrl} failed after ${ms}ms`,
          error instanceof Error ? error : new Error(String(error)),
        );
        return throwError(() => error);
      }),
    );
  }
}
