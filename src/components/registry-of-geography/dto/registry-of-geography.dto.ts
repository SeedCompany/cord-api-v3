import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredString } from '../../../common';

@ObjectType({
  implements: [Resource],
})
export class RegistryOfGeography extends Resource {
  @Field()
  readonly name: SecuredString;

  @Field()
  readonly registryId: SecuredString;
}
