import { ArgsType, Field, Args as IArgs, ResolveField } from '@nestjs/graphql';
import { type EnumType, makeEnum } from '@seedcompany/nest';
import { stripIndent } from 'common-tags';
import { URL } from 'url';
import { OptionalField } from '~/common';

export const Resolver = () =>
  ResolveField(() => URL, {
    description: stripIndent`
      A url to the file.

      This url could require authentication.
    `,
  });

const FileUrlKind = makeEnum({
  name: 'FileUrlKind',
  values: [
    {
      value: 'Permanent',
      description: 'A permanent url whose underlying file will not change',
    },
    {
      value: 'Evergreen',
      description: 'A url whose underlying file could be updated',
    },
  ],
});

@ArgsType()
export class FileUrlArgs {
  @Field({
    description: stripIndent`
      Whether the browser should download this file if opened directly

      This sets the \`Content-Disposition\` header to \`attachment\` instead of \`inline\`.
      https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition
    `,
  })
  download?: boolean = false;

  @Field(() => FileUrlKind, {
    description: stripIndent`
      The kind of url to generate.
    `,
  })
  kind?: EnumType<typeof FileUrlKind> = 'Permanent';

  @OptionalField({
    description: stripIndent`
      Override the name of the file.

      The file extension is appended to this.
    `,
  })
  name?: string;
}

export const Args = () => IArgs({ type: () => FileUrlArgs });

export { FileUrlArgs as Options };
