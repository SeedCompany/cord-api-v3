import { Field, InterfaceType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { Resource, SecuredProps } from '~/common';
import { RegisterResource } from '~/core/resources';

@RegisterResource()
@InterfaceType({
  implements: [Resource],
  resolveType: (obj: Changeset) => obj.__typename,
})
export class Changeset extends Resource {
  static readonly Props: string[] = keysOf<Changeset>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<Changeset>>();
  declare __typename: string;

  @Field({
    description: 'Whether this changeset is editable',
  })
  editable: boolean;

  @Field({
    description: 'Whether the changes have been applied to live data',
  })
  applied: boolean;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Changeset: typeof Changeset;
  }
}
