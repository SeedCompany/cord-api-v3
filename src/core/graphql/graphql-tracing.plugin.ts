import { Plugin } from '@nestjs/apollo';
import { FieldMiddleware } from '@nestjs/graphql';
import {
  ApolloServerPlugin as ApolloPlugin,
  GraphQLRequestExecutionListener as ExecutionListener,
  GraphQLRequestListener as Listener,
} from 'apollo-server-plugin-base';
import { GraphQLResolveInfo as ResolveInfo, ResponsePath } from 'graphql';
import { GqlContextType as ContextType } from '../../common';
import { Segment, TracingService } from '../tracing';

@Plugin()
export class GraphqlTracingPlugin implements ApolloPlugin<ContextType> {
  constructor(private readonly tracing: TracingService) {}

  async requestDidStart(): Promise<Listener<ContextType>> {
    return {
      executionDidStart: async (
        reqContext
      ): Promise<ExecutionListener<ContextType>> => {
        let segment: Segment;
        try {
          segment = this.tracing.rootSegment;
        } catch (e) {
          return {};
        }

        segment.name = reqContext.operationName ?? reqContext.queryHash;
        segment.addAnnotation(reqContext.operation.operation, true);

        // Append operation name to url since all gql requests hit a single http endpoint
        if (
          // Check if http middleware is present, confirming this is a root subsegment
          (segment as any).http?.request &&
          // Confirm operation caller didn't do it themselves.
          // They should, but it's not currently required.
          !(segment as any).http.request.url.endsWith(segment.name)
        ) {
          // @ts-expect-error xray library types suck
          (segment.http.request.url as string) += '/' + segment.name;
        }

        return {
          executionDidEnd: async (err) => {
            const userId = reqContext.context.session?.userId;
            if (userId) {
              segment.setUser?.(userId);
            }

            if (err) {
              segment.addError(err);
            }
          },
        };
      },
    };
  }

  fieldMiddleware(): FieldMiddleware {
    return ({ info, args }, next) => {
      const path = fieldPathFromInfo(info);
      return this.tracing.capture(path, async (sub) => {
        // Add info just for queries right now
        if (info.operation.operation === 'query') {
          const annotations =
            args.input && Object.keys(args).length === 1 ? args.input : args;
          for (const [key, value] of Object.entries(annotations)) {
            if (['string', 'number', 'boolean'].includes(typeof value)) {
              sub.addAnnotation(key, value as string | number | boolean);
            } else {
              sub.addMetadata(key, value);
            }
          }
        }

        await next();

        // Drop segments that took less than 10ms
        // We'll assume we don't have real logic attached to them.
        if (Date.now() / 1000 - sub.start_time < 0.01) {
          sub.parent?.removeSubsegment(sub);
        }
      });
    };
  }
}

export const fieldPathFromInfo = (info: ResolveInfo) => {
  let path: ResponsePath | undefined = info.path;
  const segments: Array<number | string> = [];
  while (path) {
    segments.unshift(path.key);
    path = path.prev;
  }
  return segments.join('.');
};
