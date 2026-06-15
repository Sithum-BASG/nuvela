import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

type ExceptionResponse = {
  code?: unknown;
  message?: unknown;
};

type StructuredMessage = string | string[];

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter<HttpException> {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const { code, message } = normalizeException(
      statusCode,
      exception.message,
      exceptionResponse,
    );

    response.status(statusCode).json({
      statusCode,
      code,
      message,
    });
  }
}

function normalizeException(
  statusCode: number,
  fallbackMessage: string,
  exceptionResponse: string | object,
): { code: string; message: StructuredMessage } {
  if (typeof exceptionResponse === 'string') {
    return {
      code: statusCodeToCode(statusCode),
      message: exceptionResponse,
    };
  }

  const body = exceptionResponse as ExceptionResponse;
  return {
    // Preserve explicit application error codes per TRD auth error shape.
    code:
      typeof body.code === 'string' ? body.code : statusCodeToCode(statusCode),
    message: normalizeMessage(body.message, fallbackMessage),
  };
}

function normalizeMessage(
  message: unknown,
  fallbackMessage: string,
): StructuredMessage {
  if (
    Array.isArray(message) &&
    message.every((item) => typeof item === 'string')
  ) {
    return message;
  }

  if (typeof message === 'string') {
    return message;
  }

  return fallbackMessage;
}

function statusCodeToCode(statusCode: number): string {
  const codes: Record<number, string> = {
    [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
    [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
    [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  };
  return codes[statusCode] ?? 'HTTP_EXCEPTION';
}
