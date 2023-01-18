import { Injectable } from '@nestjs/common';
import * as Nest from '@nestjs/common/exceptions';
import { compact, uniq } from 'lodash';
import {
  AbstractClassType,
  Exception,
  getParentTypes,
  getPreviousList,
  JsonSet,
  simpleSwitch,
} from '~/common';
import { ConfigService } from '~/core';
import * as Neo from '../database';
import { isSrcFrame } from './is-src-frame';
import { normalizeFramePath } from './normalize-frame-path';

export interface ExceptionJson {
  message: string;
  stack: string;
  code: string;
  codes: ReadonlySet<string>;
  [key: string]: unknown;
}

@Injectable()
export class ExceptionNormalizer {
  constructor(private readonly config?: ConfigService) {}

  normalize(ex: Error): ExceptionJson {
    const {
      message = ex.message,
      stack = ex.stack,
      code: _,
      codes,
      ...extensions
    } = this.gatherExtraInfo(ex);
    return {
      message,
      code: codes[0],
      codes: new JsonSet(codes),
      ...extensions,
      stack: stack
        .split('\n')
        .filter(isSrcFrame)
        .map((frame: string) =>
          this.config?.jest ? frame : normalizeFramePath(frame)
        )
        .join('\n'),
    };
  }

  private gatherExtraInfo(ex: Error): Record<string, any> {
    if (ex instanceof Nest.HttpException) {
      return this.httpException(ex);
    }

    // If the exception or any of the previous ones are a database connection
    // failure, then return that as the error. This way we can have an "unknown"
    // failure for the specific action without having to check for this error
    // in every catch statement (assuming no further logic is done).
    const exs = getPreviousList(ex, true);
    if (exs.some((e) => e instanceof Neo.ServiceUnavailableError)) {
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
    if (exs.some((e) => e instanceof Neo.ConnectionTimeoutError)) {
      return {
        codes: ['DatabaseTimeoutFailure', 'Transient', 'Database', 'Server'],
        message: 'Failed to retrieve data from CORD database',
      };
    }
    if (exs.some((e) => e instanceof Neo.SessionExpiredError)) {
      return {
        codes: ['SessionExpired', 'Transient', 'Database', 'Server'],
        message: 'The query to the database has expired',
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
    return { codes: ['Server'] };
  }

  private httpException(ex: Nest.HttpException) {
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
      ...data,
      codes,
    };
  }

  private errorToCodes(ex: Error) {
    return compact(
      getParentTypes(ex.constructor as AbstractClassType<Error>).flatMap((e) =>
        this.errorToCode(e as AbstractClassType<Error>, ex)
      )
    );
  }

  private errorToCode(type: AbstractClassType<Error>, ex: Error) {
    if (type === Nest.InternalServerErrorException) {
      return 'Server';
    }
    if (type === Nest.BadRequestException) {
      return ['Input', 'Client'];
    }
    if (type === Nest.ForbiddenException) {
      return ['Unauthorized', 'Client'];
    }
    if (type === Nest.UnauthorizedException) {
      return ['Unauthenticated', 'Client'];
    }
    if (type === Nest.HttpException) {
      return (ex as Nest.HttpException).getStatus() < 500 ? 'Client' : 'Server';
    }

    return type.name.replace(/(Exception|Error)$/, '');
  }
}
