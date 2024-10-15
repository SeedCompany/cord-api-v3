import { CustomScalar, Scalar } from '@nestjs/graphql';
import { GraphQLError, Kind, ValueNode } from 'graphql';

@Scalar('Markdown')
export class MarkdownScalar implements CustomScalar<string, string | null> {
  description = 'A string that holds Markdown formatted text';

  parseLiteral(ast: ValueNode): string | null {
    if (ast.kind !== Kind.STRING) {
      throw new GraphQLError(
        `Can only validate strings as InlineMarkdown but got a: ${ast.kind}`,
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

@Scalar('InlineMarkdown')
export class InlineMarkdownScalar extends MarkdownScalar {
  description = 'A string that holds inline Markdown formatted text';
}
