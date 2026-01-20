/* eslint-disable @seedcompany/no-restricted-imports */
import { initGraphQLTada, type VariablesOf } from 'gql.tada';
import type { JsonObject } from 'type-fest';
import { type ID } from '~/common';
import type { introspection } from './graphql-env.generated';

export const graphql = initGraphQLTada<{
  introspection: introspection;
  scalars: {
    ID: ID;
    Date: string;
    DateTime: string;
    InlineMarkdown: string;
    Markdown: string;
    RichText: object;
    URL: string;
    JSONObject: JsonObject;
    GraphQLDocument: string;
  };
  disableMasking: true;
}>();

export type { FragmentOf, ResultOf, VariablesOf } from 'gql.tada';
export { readFragment } from 'gql.tada';

export type InputOf<T> =
  VariablesOf<T> extends { input?: infer Input } ? Input : never;
