import { applyDecorators } from '@nestjs/common';
import { Field, type FieldOptions } from '@nestjs/graphql';
import { IsUrl } from 'class-validator';
import { URL } from 'url';
import type * as ValidatorJS from 'validator';

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
  );
