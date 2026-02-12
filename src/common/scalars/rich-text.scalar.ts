import { GraphQLScalarType } from 'graphql';
import { GraphQLJSONObject } from 'graphql-scalars';

/** @internal */
export const RichTextScalar = new GraphQLScalarType({
  ...GraphQLJSONObject.toConfig(),
  name: 'RichText',
  description: 'A JSON object containing data from a block styled editor',
});
