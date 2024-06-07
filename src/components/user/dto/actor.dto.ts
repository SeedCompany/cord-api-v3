import { InterfaceType, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DataObject,
  ID,
  IdField,
  NameField,
  resolveByTypename,
  Role,
  SecuredProperty,
  SecuredProps,
} from '~/common';
import { RegisterResource } from '~/core';
import { e } from '~/core/edgedb';

@RegisterResource({ db: e.Actor })
@InterfaceType({
  resolveType: resolveByTypename(Actor.name),
})
export class Actor extends DataObject {
  static readonly Props: string[] = keysOf<Actor>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<Actor>>();

  @IdField()
  readonly id: ID;
}

@ObjectType({
  implements: [Actor],
})
export abstract class SystemAgent extends Actor {
  __typename?: 'SystemAgent';

  @NameField()
  readonly name: string;

  readonly roles: readonly Role[];
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a actor'),
})
export class SecuredActor extends SecuredProperty(Actor) {}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Actor: typeof Actor;
  }
  interface ResourceDBMap {
    Actor: typeof e.Actor;
  }
}
