/* eslint-disable no-restricted-imports */
import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException as NestjsNotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
/* eslint-enable no-restricted-imports */
import { BaseExceptionFilter } from '@nestjs/core';
import { GqlContextType, GqlExceptionFilter } from '@nestjs/graphql';
import { compact, mapValues, uniq } from 'lodash';
import { Neo4jError } from 'neo4j-driver';
import {
  AbstractClassType,
  Exception,
  getParentTypes,
  getPreviousList,
  simpleSwitch,
} from '../common';
import { ConnectionTimeoutError, ServiceUnavailableError } from './database';
import { ILogger, Logger, LogLevel } from './logger';

type ExceptionInfo = ReturnType<ExceptionFilter['catchGql']>;

@Catch()
@Injectable()
export class ExceptionFilter implements GqlExceptionFilter {
  constructor(
    private readonly baseFilter: BaseExceptionFilter,
    @Logger('nest') private readonly logger?: ILogger
  ) {}

  catch(exception: Error, restHost: ArgumentsHost): any {
    if (exception && (exception as any).type === 'request.aborted') {
      this.logger?.warning('Request aborted');
      return;
    }

    let ex: ExceptionInfo;
    try {
      ex = this.catchGql(exception);
    } catch (e) {
      throw exception;
    }
    this.logIt(ex, exception);

    if (restHost.getType<GqlContextType>() !== 'graphql') {
      // This is not from a request Apollo Server is handling. Forward to default
      // exception filter, instead of throwing below which won't be caught.
      this.baseFilter.catch(exception, restHost);
      return;
    }

    // re-throw our result so that Apollo Server picks it up
    const e: Error = Object.assign(new Error(), ex);
    throw e;
  }

  private logIt(info: ExceptionInfo, error: Error) {
    if (!this.logger) {
      return;
    }
    if (error instanceof Neo4jError && error.logProps) {
      // Assume these have already been logged.
      return;
    }

    const { codes } = info.extensions;

    if (codes.includes('Validation')) {
      this.logger.notice(info.message, {
        inputErrors: mapValues(
          info.extensions.errors,
          (constraints) => Object.values(constraints)[0]
        ),
      });
      return;
    }

    // Don't spam log with warnings for unmatched requests. These are all hack attempts.
    if (
      error instanceof NestjsNotFoundException &&
      process.env.NODE_ENV === 'production'
    ) {
      return;
    }

    const level = codes.includes('Client') ? LogLevel.WARNING : LogLevel.ERROR;
    this.logger.log(level, info.message, {
      exception: error,
    });
  }

  catchGql(ex: Error) {
    const {
      message = ex.message,
      stack = ex.stack,
      ...extensions
    } = this.gatherExtraInfo(ex);
    if (!extensions.codes) {
      extensions.codes = [extensions.code];
    } else if (!extensions.code) {
      extensions.code = extensions.codes[0];
    }
    return {
      message,
      stack,
      extensions,
    };
  }

  private gatherExtraInfo(ex: Error): Record<string, any> {
    if (ex instanceof HttpException) {
      return this.httpException(ex);
    }

    // If the exception or any of the previous ones are a database connection
    // failure, then return that as the error. This way we can have an "unknown"
    // failure for the specific action without having to check for this error
    // in every catch statement (assuming no further logic is done).
    const exs = getPreviousList(ex, true);
    if (exs.some((e) => e instanceof ServiceUnavailableError)) {
      return {
        codes: [
          'DatabaseConnectionFailure',
          'ServiceUnavailable',
          'Transient',
          'Database',
          'Server',
        ],
        message: 'Failed to connect to CORD database',
      };
    }
    if (exs.some((e) => e instanceof ConnectionTimeoutError)) {
      return {
        codes: ['DatabaseTimeoutFailure', 'Transient', 'Database', 'Server'],
        message: 'Failed to retrieve data from CORD database',
      };
    }

    if (ex instanceof Exception) {
      const { name, message, stack, previous, ...rest } = ex;
      return {
        codes: this.errorToCodes(ex),
        ...rest,
      };
    }

    // Fallback to generic Error
    return {
      code: 'InternalServerError',
      status: 500,
    };
  }

  private httpException(ex: HttpException) {
    const res = ex.getResponse();
    const {
      message,
      error = undefined,
      ...data
    } = typeof res === 'string'
      ? { message: res }
      : (res as { message: string; error?: string });

    let codes = this.errorToCodes(ex);
    if (error) {
      let code = error.replace(/\s/g, '');
      code =
        simpleSwitch(code, {
          InternalServerError: 'Server',
          BadRequest: 'Input',
          Forbidden: 'Unauthorized',
          Unauthorized: 'Unauthenticated',
        }) ?? code;
      codes = [code, ...codes];
    }
    if ('code' in data) {
      codes = [(data as { code: string }).code, ...codes];
    }
    codes = uniq(codes);

    return {
      codes,
      status: ex.getStatus(),
      ...data,
    };
  }

  private errorToCodes(ex: Error) {
    return compact(
      getParentTypes(ex.constructor).flatMap((e) => this.errorToCode(e, ex))
    );
  }

  private errorToCode(type: AbstractClassType<Error>, ex: Error) {
    if (type === InternalServerErrorException) {
      return 'Server';
    }
    if (type === BadRequestException) {
      return ['Input', 'Client'];
    }
    if (type === ForbiddenException) {
      return ['Unauthorized', 'Client'];
    }
    if (type === UnauthorizedException) {
      return ['Unauthenticated', 'Client'];
    }
    if (type === HttpException) {
      return (ex as HttpException).getStatus() < 500 ? 'Client' : 'Server';
    }

    return type.name.replace(/(Exception|Error)$/, '');
  }
}
