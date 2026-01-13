import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { many } from '@seedcompany/common';
import { GraphQLError } from 'graphql';
import {
  handleStreamOrSingleExecutionResult,
  isAsyncIterable,
} from 'graphql-yoga';
import { LazyGetter } from 'lazy-get-decorator';
import { ExceptionFilter } from '../exception/exception.filter';
import {
  ExceptionNormalizer,
  NormalizedException,
} from '../exception/exception.normalizer';
import { Plugin } from './plugin.decorator';

declare module 'graphql' {
  interface GraphQLErrorExtensions {
    code?: string;
    codes?: ReadonlySet<string>;
    stacktrace?: string[];
  }
}

@Plugin()
@Injectable()
export class GraphqlErrorFormatter {
  constructor(private readonly moduleRef: ModuleRef) {}

  @LazyGetter() private get normalizer() {
    return this.moduleRef.get(ExceptionNormalizer, { strict: false });
  }
  @LazyGetter() private get filter() {
    return this.moduleRef.get(ExceptionFilter, { strict: false });
  }

  onValidate: Plugin['onValidate'] =
    () =>
    ({ result, setResult }) => {
      if (result.length > 0) {
        const errors = result.flatMap((error) => this.formatError(error));
        setResult(errors);
      }
    };

  onExecute: Plugin['onExecute'] = () => ({
    onExecuteDone: (params) =>
      handleStreamOrSingleExecutionResult(params, ({ result, setResult }) => {
        if (result.errors && result.errors.length > 0) {
          const errors = result.errors.flatMap((error) =>
            this.formatError(error),
          );
          setResult({ ...result, errors });
        }
      }),
  });

  onSubscribe: Plugin['onSubscribe'] = () => ({
    onSubscribeResult: ({ result, setResult }) => {
      if (isAsyncIterable(result)) {
        return;
      }
      // This happens when the subscription resolver throws an error
      if (result.errors) {
        const errors = result.errors.flatMap((error) =>
          this.formatError(error),
        );
        setResult({ ...result, errors });
      }
    },
    // This is called when the iterable stream emits an error
    onSubscribeError: ({ error, setError }) => {
      const formatted = this.formatError(error);
      // Wrap the many errors into a single aggregate that can be thrown.
      // Yoga throws this.
      // Individual transport protocols should understand to unwrap this
      // into the error array of the FormattedExecutionResult.
      setError(new AggregateError(many(formatted)));
    },
  });

  formatError = (error: unknown) => {
    if (!(error instanceof GraphQLError)) {
      // I don't think this happens.
      return new GraphQLError(
        error instanceof Error ? error.message : String(error),
      );
    }

    const normalized =
      error.originalError instanceof NormalizedException
        ? error.originalError.normalized
        : this.normalizer.normalize({
            ex: error.originalError ?? error,
            gql: error,
          });

    // If this is an error has not gone through the ExceptionFilter,
    // the logging was skipped - log error now.
    if (!(error.originalError instanceof NormalizedException)) {
      this.filter.logIt(normalized, error.originalError ?? error);
    }

    // Unwrap AggregateError's errors to flat gql errors
    return (normalized.aggregatees ?? [normalized]).map((innerEx) => {
      const { message, stack, code: _, ...extensions } = innerEx;
      const { codes } = extensions;

      // Schema & validation errors don't have meaningful stack traces, so remove them
      const worthlessTrace = codes.has('Validation') || codes.has('GraphQL');
      if (!worthlessTrace) {
        extensions.stacktrace = stack.split('\n');
      }

      return new GraphQLError(message, {
        nodes: error.nodes,
        positions: error.positions,
        path: error.path,
        extensions: { ...error.extensions, ...extensions },
      });
    });
  };
}
