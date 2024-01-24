import { Args, ResolveField } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { URL } from 'url';

export const Resolver = () =>
  ResolveField(() => URL, {
    description: stripIndent`
      A url to the file.

      This url could require authentication.
    `,
  });

export const DownloadArg = () =>
  Args('download', {
    description: stripIndent`
      Whether the browser should download this file if opened directly

      This sets the \`Content-Disposition\` header to \`attachment\` instead of \`inline\`.
      https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition
    `,
    defaultValue: false,
  });
