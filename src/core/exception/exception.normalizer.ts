import { type ArgumentsHost, Inject, Injectable } from '@nestjs/common';
// eslint-disable-next-line no-restricted-imports,@seedcompany/no-restricted-imports
import * as Nest from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { entries, isNotFalsy, simpleSwitch } from '@seedcompany/common';
import * as Gel from 'gel';
import * as GelTags from 'gel/dist/errors/tags.js';
import { GraphQLError } from 'graphql';
import addIndent from 'indent-string';
import { lowerCase, uniq } from 'lodash';
import {
  type AbstractClassType,
  DuplicateException,
  Exception,
  getCauseList,
  getParentTypes,
  InputException,
  JsonSet,
  NotFoundException,
  ServerException,
} from '~/common';
import type { ConfigService } from '~/core';
import * as Neo from '../database/errors';
import { ExclusivityViolationError } from '../gel/errors';
import { ResourcesHost } from '../resources/resources.host';
import { isSrcFrame } from './is-src-frame';
import { normalizeFramePath } from './normalize-frame-path';

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
  constructor(
    @Inject('CONFIG') private readonly config?: ConfigService & {},
    private readonly resources?: ResourcesHost,
  ) {}

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
      stack: this.getStack(params),
    };
  }

  private gatherExtraInfo(params: NormalizeParams): Record<string, any> {
    let { ex } = params;
    const { context } = params;

    if (ex instanceof Nest.HttpException) {
      return this.httpException(ex);
    }

    // If the exception or any of the previous ones are a database connection
    // failure, then return that as the error. This way we can have an "unknown"
    // failure for the specific action without having to check for this error
    // in every catch statement (assuming no further logic is done).
    const exs = getCauseList(ex);
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

    // Again, dig deep here to find connection errors.
    // These would be the root problem that we'd want to expose.
    const gelError = exs.find(
      (e): e is Gel.GelError => e instanceof Gel.GelError,
    );
    if (
      gelError &&
      (gelError instanceof Gel.AvailabilityError ||
        gelError instanceof Gel.ClientConnectionError)
    ) {
      return {
        codes: this.errorToCodes(ex),
        message: 'Failed to connect to CORD database',
      };
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

    const gqlContext =
      context && context.getType() === 'graphql'
        ? GqlExecutionContext.create(context as any)
        : undefined;

    ex = this.wrapIDNotFoundError(params, gqlContext);

    if (ex instanceof ExclusivityViolationError) {
      ex = DuplicateException.fromDB(ex, gqlContext);
      // TODO Neo4j UniquenessError could be moved here too - currently manually in service files
    } else if (ex instanceof Gel.GelError || Neo.isNeo4jError(ex)) {
      // Mask actual DB error with a nicer user error message.
      let message = 'Failed';
      if (gqlContext) {
        const info = gqlContext.getInfo();
        if (info.operation.operation === 'mutation') {
          message += ` to ${lowerCase(info.fieldName)}`;
        }
      }
      return {
        message,
        codes: this.errorToCodes(ex),
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
      if (ex.extensions.code === 'GRAPHQL_VALIDATION_FAILED') {
        return { codes: ['Validation', 'GraphQL', 'Client'] };
      }
      if (ex.extensions.code === 'GRAPHQL_PARSE_FAILED') {
        return { codes: ['Parse', 'GraphQL', 'Client'] };
      }
      if (ex.extensions.code === 'OPERATION_RESOLUTION_FAILURE') {
        return { codes: ['OperationResolution', 'GraphQL', 'Client'] };
      }
      const status = (ex.extensions as any).http?.status ?? 500;
      if (status === 413 && ex.message.startsWith('Batching is limited')) {
        return { codes: ['BatchLimit', 'GraphQL', 'Client'] };
      }
      const isClient =
        status < 500 ||
        // Guessing here. No execution path - client problem.
        !ex.path;
      return { codes: ['GraphQL', isClient ? 'Client' : 'Server'] };
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

  /**
   * Convert ID not found database errors from user input
   * to user input NotFound error with that input path.
   */
  private wrapIDNotFoundError(
    { ex, gql }: NormalizeParams,
    gqlContext: GqlExecutionContext | undefined,
  ) {
    if (!(ex instanceof Gel.CardinalityViolationError)) {
      return ex;
    }

    const matched = ex.message.match(/'(.+)' with id '(.+)' does not exist/);
    if (!matched) {
      return ex;
    }
    const type = matched[1]!;
    const id = matched[2]!;
    const typeName = this.resources ? this.resources.getByGel(type).name : type;

    if (gql?.path && gql.path.length > 1) {
      // This error was thrown from a field resolver.
      // Because this is not directly from user input, it is a server error.
      // Still make the error nicer.
      const wrapped = new ServerException(
        `Field \`${gql.path.join('.')}\` failed to use valid ${typeName} id`,
        ex,
      );
      return Object.assign(wrapped, { idNotFound: id });
    }

    const inputPath = entries(InputException.getFlattenInput(gqlContext)).find(
      ([_, value]) => value === id,
    )?.[0];
    if (!inputPath) {
      /*
       TODO Just because we can't identify the input path we don't make the ex nicer?
         NotFound requires a field, which is why we do this.
         But is there a case where we have NotFound without a field?
      */
      return ex;
    }

    const wrapped = new NotFoundException(
      `${typeName} could not be found`,
      inputPath,
      ex,
    );
    return Object.assign(wrapped, { idNotFound: id });
  }

  private getStack({ ex }: NormalizeParams) {
    return getCauseList(ex)
      .map((e) =>
        (e.stack ?? e.message)
          .split('\n')
          .filter(isSrcFrame)
          .map((frame: string) =>
            this.config?.jest ? frame : normalizeFramePath(frame),
          )
          .join('\n'),
      )
      .map((e, i) => addIndent(i > 0 ? `[cause]: ${e}` : e, i * 2))
      .join('\n');
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
    return getParentTypes(ex.constructor as AbstractClassType<Error>)
      .flatMap((e) => this.errorToCode(e as AbstractClassType<Error>, ex))
      .filter(isNotFalsy);
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
    if (type === Nest.IntrinsicException) {
      return [];
    }
    if (type === Gel.GelError) {
      const transient =
        ex instanceof Gel.GelError &&
        (ex.hasTag(GelTags.SHOULD_RECONNECT) ||
          ex.hasTag(GelTags.SHOULD_RETRY));
      return [...(transient ? ['Transient'] : []), 'Database', 'Server'];
    }
    if (Neo.isNeo4jError(ex)) {
      return [
        (ex.code === 'N/A' ? '' : ex.code)
          .split('.')
          .at(-1)!
          .replaceAll(/(Error|Failed)/g, ''),
        ex.classification === 'TRANSIENT_ERROR' && 'Transient',
        'Database',
        'Server',
      ].filter(isNotFalsy);
    }

    return type.name.replace(/(Exception|Error)$/, '');
  }
}
