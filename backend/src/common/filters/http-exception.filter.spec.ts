import {
  ConflictException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();
  let json: jest.Mock;
  let status: jest.Mock;

  beforeEach(() => {
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
  });

  function runFilter(exception: HttpException): void {
    const response = { status } as unknown as Response;
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
      }),
    } as ArgumentsHost;
    filter.catch(exception, host);
  }

  it('preserves explicit application error codes', () => {
    runFilter(
      new UnauthorizedException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Verify your email before logging in.',
      }),
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.UNAUTHORIZED,
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Verify your email before logging in.',
    });
  });

  it('maps generic forbidden responses to FORBIDDEN', () => {
    runFilter(new ConflictException('conflict'));

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      code: 'HTTP_EXCEPTION',
      message: 'conflict',
    });
  });

  it('returns validation message arrays from class-validator', () => {
    runFilter(
      new HttpException(
        {
          message: ['email must be an email', 'password should not be empty'],
        },
        HttpStatus.BAD_REQUEST,
      ),
    );

    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'HTTP_EXCEPTION',
      message: ['email must be an email', 'password should not be empty'],
    });
  });

  it('defaults missing codes from HTTP status', () => {
    runFilter(new HttpException('Not found', HttpStatus.NOT_FOUND));

    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      code: 'NOT_FOUND',
      message: 'Not found',
    });
  });
});
