import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { GqlArgumentsHost, GqlExceptionFilter } from '@nestjs/graphql';
import { Exception, simpleSwitch } from '../common';

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
    if (ex instanceof HttpException) {
      return this.httpException(ex);
    }
    if (ex instanceof Exception) {
      const { name, message, stack, previous, ...rest } = ex;
      return {
        code: name.replace(/(Exception|Error)$/, ''),
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
    const { message, error = undefined, ...data } =
      typeof res === 'string'
        ? { message: res }
        : (res as { message: string; error?: string });

    let code = error
      ? error.replace(/\s/g, '')
      : ex.constructor.name.replace(/(Exception|Error)$/, '');
    code =
      simpleSwitch(code, {
        InternalServerError: 'Server',
        BadRequest: 'Input',
        Forbidden: 'Unauthorized',
        Unauthorized: 'Unauthenticated',
      }) ?? code;

    return {
      code,
      status: ex.getStatus(),
      ...data,
    };
  }
}
