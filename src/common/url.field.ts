import { applyDecorators } from '@nestjs/common';
import { CustomScalar, Field, FieldOptions, Scalar } from '@nestjs/graphql';
import { IsUrl } from 'class-validator';
import { GraphQLError, Kind, ValueNode } from 'graphql';
import { URL } from 'url';
import ValidatorJS from 'validator';
import { externalUrlWithProtocol } from '~/common/url.util';
import { Transform } from './transform.decorator';

export const UrlField = ({
  url,
  ...options
}: FieldOptions & { url?: ValidatorJS.IsURLOptions } = {}) =>
  applyDecorators(
    Field(() => URL, options),
    IsUrl({
      protocols: ['http', 'https'],
      // eslint-disable-next-line @typescript-eslint/naming-convention
      require_protocol: true,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      require_tld: false,
      ...url,
    }),
    Transform(({ value: str }) => {
      return str
        ? url?.require_protocol
          ? externalUrlWithProtocol(str)
          : str
        : null;
    }),
  );

@Scalar('CustomURL', () => URL)
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
