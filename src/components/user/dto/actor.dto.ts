import { InterfaceType, ObjectType } from '@nestjs/graphql';
import {
  DataObject,
  type ID,
  IdField,
  NameField,
  type Role,
  SecuredProperty,
} from '~/common';
import { RegisterResource } from '~/core/resources';

@RegisterResource()
@InterfaceType()
export class Actor extends DataObject {
  declare readonly __typename: 'User' | 'SystemAgent';

  @IdField()
  readonly id: ID;
}

@RegisterResource()
@ObjectType({
  implements: [Actor],
})
export abstract class SystemAgent extends Actor {
  declare readonly __typename: 'SystemAgent';

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
    SystemAgent: typeof SystemAgent;
  }
}
