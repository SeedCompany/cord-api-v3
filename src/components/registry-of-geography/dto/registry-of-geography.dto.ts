import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredProperty, SecuredString } from '../../../common';

@ObjectType({
  implements: [Resource],
})
export class RegistryOfGeography extends Resource {
  @Field()
  readonly name: SecuredString;

  @Field()
  readonly registryId: SecuredString;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a registry of geography'),
})
export class SecuredRegistryOfGeography extends SecuredProperty(
  RegistryOfGeography
) {}
