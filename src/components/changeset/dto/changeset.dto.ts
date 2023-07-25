import { Field, InterfaceType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { RegisterResource } from '~/core';
import { Resource, SecuredProps } from '../../../common';

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
