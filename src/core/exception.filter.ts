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
  catch(exception: Error, restHost: ArgumentsHost): any {
    const _host = GqlArgumentsHost.create(restHost); // when needed
    let ex;
    try {
      ex = this.catchGql(exception);
    } catch (e) {
      throw exception;
    }
    const e: Error = Object.assign(new Error(), ex);
    throw e;
  }

  catchGql(ex: Error) {
    const {
      message = ex.message,
      stack = ex.stack,
      ...extensions
    } = this.gatherExtraInfo(ex);
    return {
      message,
      stack,
      extensions,
    };
  }

  private gatherExtraInfo(ex: Error): Record<string, any> {
    if (ex instanceof ValidationException) {
      return this.validationException(ex);
    }
    if (ex instanceof HttpException) {
      return this.httpException(ex);
    }

    // Fallback to generic Error
    return {
      code: 'InternalServerError',
      status: 500,
    };
  }

  private httpException(ex: HttpException) {
    const res = ex.getResponse();
    const { message, error = undefined, ...data } =
      typeof res === 'string'
        ? { message: res }
        : (res as { message: string; error?: string });

    const code = error
      ? error.replace(/\s/g, '')
      : ex.constructor.name.replace(/(Exception|Error)$/, '');

    return {
      code,
      status: ex.getStatus(),
      ...data,
    };
  }

  private validationException(ex: ValidationException) {
    return {
      message: 'Input validation failed',
      code: 'Validation',
      status: 400,
      errors: this.flattenValidationErrors(ex.errors),
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
