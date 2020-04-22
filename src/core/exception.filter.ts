import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { GqlArgumentsHost, GqlExceptionFilter } from '@nestjs/graphql';

@Catch()
export class ExceptionFilter implements GqlExceptionFilter {
  catch(exception: unknown, restHost: ArgumentsHost): any {
    let ex;
    try {
      ex = this.catchGql(exception, GqlArgumentsHost.create(restHost));
    } catch (e) {
      throw exception;
    }
    throw Object.assign(new Error(), ex);
  }

  catchGql(ex: unknown, host: GqlArgumentsHost) {
    if (ex instanceof HttpException) {
      return this.httpException(ex, host);
    }

    return ex;
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
}
