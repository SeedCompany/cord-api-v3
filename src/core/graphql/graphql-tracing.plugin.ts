import { FieldMiddleware } from '@nestjs/graphql';
import { createHash } from 'crypto';
import { GraphQLResolveInfo as ResolveInfo, ResponsePath } from 'graphql';
import { Segment, TracingService } from '../tracing';
import { Plugin } from './plugin.decorator';

@Plugin()
export class GraphqlTracingPlugin {
  constructor(private readonly tracing: TracingService) {}

  onExecute: Plugin['onExecute'] = ({ args }) => {
    const { operationName, contextValue } = args;
    const { operation, session$, params } = contextValue;

    let segment: Segment;
    try {
      segment = this.tracing.rootSegment;
    } catch (e) {
      return {};
    }

    segment.name =
      operationName ??
      (params.query
        ? createHash('sha256').update(params.query).digest('hex')
        : undefined);
    segment.addAnnotation(operation.operation, true);

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
      onExecuteDone: () => {
        const userId = session$.value?.userId;
        if (userId) {
          segment.setUser?.(userId);
        }

        return {
          onNext: ({ result }) => {
            for (const error of result.errors ?? []) {
              segment.addError(error);
            }
          },
        };
      },
    };
  };

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
