import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { GraphQLError, GraphQLErrorExtensions } from 'graphql';
import { MaskError } from 'graphql-yoga';
import { LazyGetter } from 'lazy-get-decorator';
import { JsonSet } from '~/common';
import { ExceptionFilter } from '../exception/exception.filter';
import { ExceptionNormalizer } from '../exception/exception.normalizer';

declare module 'graphql' {
  interface GraphQLErrorExtensions {
    code?: string;
    codes?: ReadonlySet<string>;
    stacktrace?: string[];
  }
}

@Injectable()
export class GraphqlErrorFormatter {
  constructor(private readonly moduleRef: ModuleRef) {}

  @LazyGetter() private get normalizer() {
    return this.moduleRef.get(ExceptionNormalizer, { strict: false });
  }
  @LazyGetter() private get filter() {
    return this.moduleRef.get(ExceptionFilter, { strict: false });
  }

  formatError: MaskError = (error, msg, isDev) => {
    const { message, ...extensions } = this.getErrorExtensions(error);

    const codes = (extensions.codes ??= new JsonSet(['Server']));
    delete extensions.code;

    // Schema & validation errors don't have meaningful stack traces, so remove them
    const worthlessTrace = codes.has('Validation') || codes.has('GraphQL');
    if (worthlessTrace) {
      delete extensions.stacktrace;
    }

    return new GraphQLError(
      message && typeof message === 'string'
        ? message
        : (error as Error).message,
      {
        extensions,
      },
    );
  };

  private getErrorExtensions(
    error: unknown | /* but probably a */ GraphQLError,
  ): GraphQLErrorExtensions {
    // ExceptionNormalizer has already been called
    if (
      error instanceof GraphQLError &&
      error.extensions?.codes instanceof Set
    ) {
      return {
        ...error.extensions,
        stacktrace: error.stack!.split('\n'),
      };
    }

    const original =
      error instanceof GraphQLError ? error.originalError : undefined;
    // Safety check
    if (!(original instanceof Error)) {
      return {};
    }

    // Some errors do not go through the global exception filter.
    // ResolveField() calls is one of them.
    // Normalized & log here.
    const normalized = this.normalizer.normalize({
      ex: original,
      gql: error instanceof GraphQLError ? error : undefined,
    });
    this.filter.logIt(normalized, original);
    const { stack, ...extensions } = normalized;
    return {
      ...extensions,
      stacktrace: stack.split('\n'),
    };
  }
}
