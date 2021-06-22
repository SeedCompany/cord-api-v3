import { InterfaceType } from '@nestjs/graphql';
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
}
