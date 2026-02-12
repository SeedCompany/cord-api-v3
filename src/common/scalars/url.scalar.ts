import { type CustomScalar, Scalar } from '@nestjs/graphql';
import { GraphQLError, Kind, type ValueNode } from 'graphql';
import { URL } from 'url';

@Scalar('URL', () => URL)
export class UrlScalar implements CustomScalar<string, string | null> {
  description =
    'A field whose value conforms to the standard URL format as specified in RFC3986: https://www.ietf.org/rfc/rfc3986.txt.';

  parseLiteral(ast: ValueNode): string | null {
    if (ast.kind !== Kind.STRING) {
      throw new GraphQLError(
        `Can only validate strings as URLs but got a: ${ast.kind}`,
      );
    }
    return ast.value;
  }
  parseValue(value: any) {
    return value;
  }
  serialize(value: any) {
    return value;
  }
}
