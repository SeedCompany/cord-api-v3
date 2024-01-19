import { ApolloServerErrorCode as ApolloCode } from '@apollo/server/errors';
import { ArgumentsHost, Inject, Injectable } from '@nestjs/common';
// eslint-disable-next-line no-restricted-imports
import * as Nest from '@nestjs/common';
import {
  GqlContextType as ContextKey,
  GqlExecutionContext,
} from '@nestjs/graphql';
import { isNotFalsy, setHas, setOf, simpleSwitch } from '@seedcompany/common';
import * as Edge from 'edgedb';
import * as EdgeDBTags from 'edgedb/dist/errors/tags.js';
import { GraphQLError, GraphQLResolveInfo } from 'graphql';
import { lowerCase, uniq } from 'lodash';
import {
  AbstractClassType,
  DuplicateException,
  Exception,
  getParentTypes,
  getPreviousList,
  JsonSet,
} from '~/common';
import type { ConfigService } from '~/core';
import * as Neo from '../database/errors';
import { ExclusivityViolationError } from '../edgedb/exclusivity-violation.error';
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
  constructor(@Inject('CONFIG') private readonly config?: ConfigService) {}

  normalize(ex: Error, context?: ArgumentsHost): ExceptionJson {
    const {
      message = ex.message,
      stack = ex.stack,
      code: _,
      codes,
      ...extensions
    } = this.gatherExtraInfo(ex, context);
    return {
      message,
      code: codes[0],
      codes: new JsonSet(codes),
      ...extensions,
      stack: stack
        .split('\n')
        .filter(isSrcFrame)
        .map((frame: string) =>
          this.config?.jest ? frame : normalizeFramePath(frame),
        )
        .join('\n'),
    };
  }

  private gatherExtraInfo(
    ex: Error,
    context?: ArgumentsHost,
  ): Record<string, any> {
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

    // Again, dig deep here to find connection errors.
    // These would be the root problem that we'd want to expose.
    const edgeError = exs.find(
      (e): e is Edge.EdgeDBError => e instanceof Edge.EdgeDBError,
    );
    if (
      edgeError &&
      (edgeError instanceof Edge.AvailabilityError ||
        edgeError instanceof Edge.ClientConnectionError)
    ) {
      return {
        codes: this.errorToCodes(ex),
        message: 'Failed to connect to CORD database',
      };
    }

    const gqlContext =
      context && context.getType<ContextKey>() === 'graphql'
        ? GqlExecutionContext.create(context as any)
        : undefined;

    if (ex instanceof ExclusivityViolationError) {
      ex = DuplicateException.fromDB(ex, gqlContext);
    } else if (ex instanceof Edge.EdgeDBError) {
      // Mask actual DB error with a nicer user error message.
      let message = 'Failed';
      if (gqlContext) {
        const info = gqlContext.getInfo<GraphQLResolveInfo>();
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
      const { name, message, stack, previous, ...rest } = ex;
      return {
        message,
        codes: this.errorToCodes(ex),
        stack,
        ...rest,
      };
    }

    // Apollo Errors
    if (ex instanceof GraphQLError) {
      const codes = this.errorToCodes(ex);
      const isClient = setHas(
        apolloErrorCodesThatAreClientProblem,
        ex.extensions.code!,
      );
      return { codes: [codes[0], 'GraphQL', isClient ? 'Client' : 'Server'] };
    }

    // Bad output from API, that doesn't match the schema
    if (ex.message.startsWith('Cannot return null for non-nullable field')) {
      return { codes: ['GraphQL', 'Server'] };
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
    if (type === Edge.EdgeDBError) {
      const transient =
        ex instanceof Edge.EdgeDBError &&
        (ex.hasTag(EdgeDBTags.SHOULD_RECONNECT) ||
          ex.hasTag(EdgeDBTags.SHOULD_RETRY));
      return [...(transient ? ['Transient'] : []), 'Database', 'Server'];
    }

    return type.name.replace(/(Exception|Error)$/, '');
  }
}

const apolloErrorCodesThatAreClientProblem = setOf([
  ApolloCode.GRAPHQL_PARSE_FAILED,
  ApolloCode.GRAPHQL_VALIDATION_FAILED,
  ApolloCode.PERSISTED_QUERY_NOT_FOUND,
  ApolloCode.PERSISTED_QUERY_NOT_SUPPORTED,
  ApolloCode.BAD_USER_INPUT,
  ApolloCode.BAD_REQUEST,
]);
