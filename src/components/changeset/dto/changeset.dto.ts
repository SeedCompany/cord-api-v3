import { Field, InterfaceType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { keys as keysOf } from 'ts-transformer-keys';
import { Resource, SecuredProps } from '../../../common';

@InterfaceType({
  implements: [Resource],
  resolveType: (obj: Changeset) => obj.__typename,
})
export class Changeset extends Resource {
  static readonly Props: string[] = keysOf<Changeset>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<Changeset>>();
  __typename: string;

  @Field({
    description: 'Whether this changeset is editable or finalized',
  })
  finalized: boolean;

  @Field({
    description: stripIndent`
      Whether the changes have been applied to live data.
      This probably assumes \`finalized\` is true as well.
    `,
  })
  applied: boolean;
}
