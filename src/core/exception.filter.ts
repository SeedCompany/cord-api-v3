import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlArgumentsHost, GqlExceptionFilter } from '@nestjs/graphql';
import { compact, uniq } from 'lodash';
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
    const { message, error = undefined, ...data } =
      typeof res === 'string'
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
      this.getProtoChain(ex).flatMap((e) => this.errorToCode(e, ex))
    );
  }

  private getProtoChain<T = object>(obj: T, chain: T[] = []): T[] {
    if (!obj || typeof obj !== 'object') {
      return chain;
    }
    const ex = Object.getPrototypeOf(obj);
    if (ex == null) {
      return chain.slice(0, -1);
    }
    return this.getProtoChain(ex, [...chain, ex]);
  }

  private errorToCode(obj: object, ex: Error) {
    const type = obj.constructor;

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
