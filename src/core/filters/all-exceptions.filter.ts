import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AppError } from '@utils/errors/index';
import { LoggingService } from '../logging/logging.service';

/**
 * Last-resort filter for **unexpected** errors (anything that is not an
 * `HttpException`, e.g. a `TypeError`). Keeps the `AppError` response contract
 * consistent while never leaking internals to the client.
 *
 * Registered globally in `main.ts` **after** {@link HttpExceptionFilter}, which
 * handles all `HttpException`s first.
 */
@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger: LoggingService;

  constructor(logger: LoggingService) {
    this.logger = logger.withContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body: AppError = {
      error: 'Internal Server Error',
      statusCode: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    };

    this.logger.error(
      `${request?.method ?? '-'} ${request?.url ?? '-'} -> 500 ${body.statusCode}`,
      exception instanceof Error ? exception : new Error(String(exception)),
    );

    response.status(500).json(body);
  }
}
