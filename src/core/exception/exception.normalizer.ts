import { type ArgumentsHost, Inject, Injectable } from '@nestjs/common';
// eslint-disable-next-line no-restricted-imports,@seedcompany/no-restricted-imports
import * as Nest from '@nestjs/common';
import { isNotFalsy, simpleSwitch } from '@seedcompany/common';
import { GraphQLError } from 'graphql';
import { uniq } from 'lodash';
import type { AbstractClass } from 'type-fest';
import { Exception, getParentTypes, JsonSet } from '~/common';
import type { ConfigService } from '~/core/config';
import { prettyStack } from './pretty-stack';

interface NormalizeParams {
  ex: Error;
  /** Errors thrown in Query/Mutation/Controller methods will have this via ExceptionFilter. */
  context?: ArgumentsHost;
  /**
   * Errors thrown in ResolveField methods (or other GQL communication problems) will have this.
   * This is essentially mutatally exclusuve with {@link context}.
   */
  gql?: GraphQLError;
}

export interface ExceptionJson {
  message: string;
  stack: string;
  code: string;
  codes: ReadonlySet<string>;
  /** From {@link AggregateError.errors} */
  aggregatees?: readonly ExceptionJson[];
  [key: string]: unknown;
}

/**
 * Denote normalization has already happened for this error.
 * So the GQL server can know accurately if it needs to normalize or not.
 */
export class NormalizedException extends Error {
  constructor(readonly normalized: ExceptionJson) {
    super(normalized.message);
  }
}

@Injectable()
export class ExceptionNormalizer {
  constructor(@Inject('CONFIG') private readonly config?: ConfigService & {}) {}

  normalize(params: NormalizeParams): ExceptionJson {
    const {
      message = params.ex.message,
      code: _,
      codes,
      ...extensions
    } = this.gatherExtraInfo(params);
    return {
      message,
      code: codes[0],
      codes: new JsonSet(codes),
      ...extensions,
      stack: prettyStack(params.ex, {
        relativePaths: !this.config?.jest,
      }),
    };
  }

  private gatherExtraInfo(params: NormalizeParams): Record<string, any> {
    const { ex } = params;

    if (ex instanceof Nest.HttpException) {
      return this.httpException(ex);
    }

    if (
      ex instanceof AggregateError &&
      // not subclassed
      ex.name === 'AggregateError'
    ) {
      const aggregatees = ex.errors.map((e) =>
        this.normalize({
          ...params,
          ex: e,
        }),
      );
      return {
        aggregatees,
        // shrug?
        codes: [
          aggregatees.every((e) => e.codes.has('Client')) ? 'Client' : 'Server',
        ],
      };
    }

    if (ex instanceof Exception) {
      const { name, message, stack, ...rest } = ex;
      return {
        message,
        codes: this.errorToCodes(ex),
        ...rest,
      };
    }

    if (ex instanceof GraphQLError) {
      const { code, codes: codesIn, stacktrace, ...rest } = ex.extensions;
      const codes =
        simpleSwitch(code, {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          GRAPHQL_VALIDATION_FAILED: ['Validation', 'GraphQL', 'Client'],
          // eslint-disable-next-line @typescript-eslint/naming-convention
          GRAPHQL_PARSE_FAILED: ['Parse', 'GraphQL', 'Client'],
          // eslint-disable-next-line @typescript-eslint/naming-convention
          OPERATION_RESOLUTION_FAILURE: [
            'OperationResolution',
            'GraphQL',
            'Client',
          ],
        }) ?? (codesIn instanceof JsonSet ? codesIn : undefined);
      if (codes) {
        return { ...rest, codes };
      }
      const status = (ex.extensions as any).http?.status ?? 500;
      if (status === 413 && ex.message.startsWith('Batching is limited')) {
        return { ...rest, codes: ['BatchLimit', 'GraphQL', 'Client'] };
      }
      const isClient =
        status < 500 ||
        // Guessing here. No execution path - client problem.
        !ex.path;
      return { ...rest, codes: ['GraphQL', isClient ? 'Client' : 'Server'] };
    }

    // Bad output from API, that doesn't match the schema
    if (ex.message.startsWith('Cannot return null for non-nullable field')) {
      return { codes: ['GraphQL', 'Server'] };
    }

    // Fastify convention
    if (
      'code' in ex &&
      typeof ex.code === 'string' &&
      ex.code.startsWith('FST_')
    ) {
      const statusCode =
        'statusCode' in ex && typeof ex.statusCode === 'number'
          ? ex.statusCode
          : undefined;
      const codes = [
        ex.code,
        statusCode && statusCode < 500 ? 'Client' : 'Server',
      ];
      return { codes };
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
    return getParentTypes(ex.constructor as AbstractClass<Error>)
      .flatMap((e) => this.errorToCode(e as AbstractClass<Error>, ex))
      .filter(isNotFalsy);
  }

  private errorToCode(type: AbstractClass<Error>, ex: Error) {
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
    if (type === Nest.IntrinsicException) {
      return [];
    }
    return type.name.replace(/(Exception|Error)$/, '');
  }
}
