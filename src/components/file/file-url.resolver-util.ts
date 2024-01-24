import { ResolveField } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { URL } from 'url';

export const Resolver = () =>
  ResolveField(() => URL, {
    description: stripIndent`
      A url to the file.

      This url could require authentication.
    `,
  });
