import { unwrapResolverError } from '@apollo/server/errors';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  GraphQLErrorExtensions as ErrorExtensions,
  GraphQLFormattedError as FormattedError,
  GraphQLError,
} from 'graphql';
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

  formatError = (
    formatted: FormattedError,
    error: unknown | /* but probably a */ GraphQLError,
  ): FormattedError => {
    const { message, ...extensions } = this.getErrorExtensions(
      formatted,
      error,
    );

    const codes = (extensions.codes ??= new JsonSet(['Server']));
    delete extensions.code;

    // Schema & validation errors don't have meaningful stack traces, so remove them
    const worthlessTrace = codes.has('Validation') || codes.has('GraphQL');
    if (worthlessTrace) {
      delete extensions.stacktrace;
    }

    return {
      message:
        message && typeof message === 'string' ? message : formatted.message,
      extensions,
      locations: formatted.locations,
      path: formatted.path,
    };
  };

  private getErrorExtensions(
    formatted: FormattedError,
    error: unknown | /* but probably a */ GraphQLError,
  ): ErrorExtensions {
    // ExceptionNormalizer has already been called
    if (formatted.extensions?.codes instanceof Set) {
      return { ...formatted.extensions };
    }

    const original = unwrapResolverError(error);
    // Safety check
    if (!(original instanceof Error)) {
      return { ...formatted.extensions };
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
