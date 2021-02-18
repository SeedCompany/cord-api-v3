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
export class FieldZone extends Resource {
  @Field()
  readonly name: SecuredString;

  readonly director: Secured<string>;

  readonly canDelete: SecuredBoolean;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a field zone'),
})
export class SecuredFieldZone extends SecuredProperty(FieldZone) {}
