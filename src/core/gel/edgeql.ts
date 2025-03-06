import { stripIndent } from 'common-tags';
import { InlineQueryMap as QueryMap } from './generated-client/inline-queries';

export const edgeql = <const Query extends string>(
  query: Query,
): Query extends keyof QueryMap ? QueryMap[Query] : unknown => {
  return new TypedEdgeQL(stripIndent(query)) as any;
};

export type EdgeQLArgsOf<T extends TypedEdgeQL<any, any>> =
  T extends TypedEdgeQL<infer Args, any> ? Args : never;

export type EdgeQLReturnOf<T extends TypedEdgeQL<any, any>> =
  T extends TypedEdgeQL<any, infer Return> ? Return : never;

// Internal symbol to mark a query as typed
const edgeqlTS = Symbol('edgeqlTS');

export class TypedEdgeQL<Args, Return> {
  constructor(readonly query: string) {}
  [edgeqlTS]?: {
    args: Args;
    return: Return;
  };
}
