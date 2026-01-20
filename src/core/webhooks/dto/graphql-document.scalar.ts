import { isDocumentNode } from '@graphql-tools/utils';
import { type CustomScalar, Scalar } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { GraphQLError, Kind, print, type ValueNode } from 'graphql';

@Scalar('GraphQLDocument')
export class GraphqlDocumentScalar implements CustomScalar<string, string> {
  description = stripIndent`
    A GraphQL document string

    JSON documents are also accepted in inputs.
  `;

  parseValue(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (isDocumentNode(value)) {
      return print(value);
    }
    throw new GraphQLError('Cannot parse value as GraphQLDocument');
  }
  serialize(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (isDocumentNode(value)) {
      return print(value);
    }
    throw new GraphQLError('Cannot serialize value as GraphQLDocument');
  }
  parseLiteral(ast: ValueNode): string {
    if (ast.kind !== Kind.STRING) {
      throw new GraphQLError(
        `Can only accept strings as inline GraphQLDocuments but got a: ${ast.kind}`,
      );
    }
    return ast.value;
  }
}
