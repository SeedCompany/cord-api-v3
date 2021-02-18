import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  Secured,
  SecuredBoolean,
  SecuredProperty,
  SecuredString,
} from '../../../common';

@ObjectType({
  implements: [Resource],
})
export class FieldRegion extends Resource {
  @Field()
  readonly name: SecuredString;

  readonly fieldZone: Secured<string>;

  readonly director: Secured<string>;

  readonly canDelete: SecuredBoolean;
}
@ObjectType({
  description: SecuredProperty.descriptionFor('a field region'),
})
export class SecuredFieldRegion extends SecuredProperty(FieldRegion) {}
