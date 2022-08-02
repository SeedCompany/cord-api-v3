import { CustomScalar, Scalar } from '@nestjs/graphql';
import { GraphQLError, Kind, ValueNode } from 'graphql';
import GraphQLJSON from 'graphql-type-json';

@Scalar('RichText', () => Object)
export class RichTextScalar implements CustomScalar<string, object> {
  description =
    'The `RichText` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf).';
  parseLiteral(ast: ValueNode): object | null {
    if (ast.kind !== Kind.OBJECT) {
      throw new GraphQLError(
        `Can only validate JSON objects but got a: ${ast.kind}`
      );
    }
    return ast;
  }

  parseValue(value: any) {
    return GraphQLJSON.parseValue(value);
  }

  serialize(value: any) {
    return GraphQLJSON.serialize(value);
  }
}
