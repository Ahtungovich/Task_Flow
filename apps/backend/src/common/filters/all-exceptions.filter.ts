import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Internal Server Error';
    let message: string | string[] = 'Внутренняя ошибка сервера. Попробуйте позже.';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = HttpStatus[statusCode] ?? 'Http Error';
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resObj = exceptionResponse as Record<string, unknown>;
        message =
          (resObj.message as string | string[]) ??
          exception.message ??
          'Ошибка запроса.';
        error = String(resObj.error ?? HttpStatus[statusCode] ?? 'Http Error');
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          statusCode = HttpStatus.CONFLICT;
          error = 'Conflict';
          message = 'Запись с такими уникальными данными уже существует.';
          break;
        case 'P2025':
          statusCode = HttpStatus.NOT_FOUND;
          error = 'Not Found';
          message = 'Запрашиваемая запись не найдена.';
          break;
        case 'P2003':
          statusCode = HttpStatus.BAD_REQUEST;
          error = 'Bad Request';
          message = 'Нарушение целостности связанных данных.';
          break;
        default:
          statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
          error = 'Database Error';
          message = 'Ошибка при обращении к базе данных.';
          this.logger.error(
            `Prisma error ${exception.code}: ${exception.message}`,
            exception.stack,
          );
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled error on ${request.method} ${request.url}: ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.error(
        `Unknown error on ${request.method} ${request.url}: ${String(exception)}`,
      );
    }

    const body: ErrorResponseBody = {
      statusCode,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(body);
  }
}
