import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AppError } from "../utils/errors";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      response.status(status).json(payload);
      return;
    }

    if (exception instanceof AppError) {
      response.status(exception.status).json({
        statusCode: exception.status,
        message: exception.message,
        path: request.url,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    this.logger.error(
      `Unhandled error on ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Errore interno",
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
