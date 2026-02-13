import { search } from '@aws-lambda-powertools/jmespath';
import { stripIndent } from 'common-tags';
import { GraphQLError, GraphQLScalarType, GraphQLString } from 'graphql';

const base = GraphQLString.toConfig();
export const JmesPathScalar = new GraphQLScalarType({
  ...base,
  name: 'JMESPath',
  description: stripIndent`
    A JMESPath expression.

    See https://jmespath.org/ for details
  `,
  specifiedByURL: 'https://jmespath.org/specification.html',
  parseLiteral: (node) => validate(base.parseLiteral(node)),
  parseValue: (value) => validate(base.parseValue(value)),
});

const validate = (value: string) => {
  try {
    search(value, {});
  } catch (e) {
    throw new GraphQLError((e as Error).message.replaceAll(/"/g, '`'));
  }
  return value;
};
