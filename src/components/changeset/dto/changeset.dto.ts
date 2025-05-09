import { Field, InterfaceType } from '@nestjs/graphql';
import { Resource } from '~/common';
import { RegisterResource } from '~/core/resources';

@RegisterResource()
@InterfaceType({
  implements: [Resource],
  resolveType: (obj: Changeset) => obj.__typename,
})
export class Changeset extends Resource {
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
