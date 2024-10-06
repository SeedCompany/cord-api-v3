import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { GraphQLError } from 'graphql';
import { handleStreamOrSingleExecutionResult } from 'graphql-yoga';
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
        const errors = result.map((error) => this.formatError(error));
        setResult(errors);
      }
    };

  onExecute: Plugin['onExecute'] = () => ({
    onExecuteDone: (params) =>
      handleStreamOrSingleExecutionResult(params, ({ result, setResult }) => {
        if (result.errors && result.errors.length > 0) {
          const errors = result.errors.map((error) => this.formatError(error));
          setResult({ ...result, errors });
        }
      }),
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

    const { message, stack, code: _, ...extensions } = normalized;
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
  };
}
