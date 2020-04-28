import {
  ArgumentsHost,
  Catch,
  HttpException,
  ValidationError,
} from '@nestjs/common';
import { GqlArgumentsHost, GqlExceptionFilter } from '@nestjs/graphql';
import { isEmpty } from 'lodash';
import { ValidationException } from './validation.pipe';

@Catch()
export class ExceptionFilter implements GqlExceptionFilter {
  catch(exception: unknown, restHost: ArgumentsHost): any {
    let ex;
    try {
      ex = this.catchGql(exception, GqlArgumentsHost.create(restHost));
    } catch (e) {
      throw exception;
    }
    const e: Error = Object.assign(new Error(), ex);
    throw e;
  }

  catchGql(ex: unknown, host: GqlArgumentsHost) {
    if (ex instanceof ValidationException) {
      return this.validationException(ex, host);
    }
    if (ex instanceof HttpException) {
      return this.httpException(ex, host);
    }

    // Fallback to generic Error
    if (ex instanceof Error) {
      return {
        message: ex.message,
        extensions: {
          code: 'InternalServerError',
          status: 500,
        },
        stack: ex.stack,
      };
    }
    // This shouldn't ever be hit...
    throw new Error(
      `Only Errors should be thrown, but ${typeof ex} thrown instead.`
    );
  }

  private httpException(ex: HttpException, _host: GqlArgumentsHost) {
    const res = ex.getResponse();
    const data =
      typeof res === 'string'
        ? { message: res, statusCode: ex.getResponse(), error: 'Unknown' }
        : (res as {
            statusCode: number;
            error: string;
            message?: string;
          });

    const message = data.message ?? data.error;
    return {
      message,
      extensions: {
        code: data.error.replace(/\s/g, ''),
        status: data.statusCode,
      },
      stack: ex.stack
        ? `Error: ${message}\n` + ex.stack.replace(/.+\n/, '')
        : undefined,
    };
  }

  private validationException(
    ex: ValidationException,
    _host: GqlArgumentsHost
  ) {
    return {
      message: 'Input validation failed',
      extensions: {
        code: 'Validation',
        status: 400,
        errors: this.flattenValidationErrors(ex.errors),
      },
      stack: ex.stack,
    };
  }

  private flattenValidationErrors(
    e: ValidationError[],
    out: Record<string, any> = {},
    prefixes: string[] = []
  ) {
    return e.reduce((obj, error) => {
      const { target: _, value: __, property, children, constraints } = error;
      const path = [...prefixes, property];
      if (!isEmpty(constraints)) {
        obj[path.join('.')] = constraints;
      }
      if (!isEmpty(children)) {
        this.flattenValidationErrors(children, obj, path);
      }
      return obj;
    }, out);
  }
}
