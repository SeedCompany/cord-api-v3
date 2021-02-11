import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  Resource,
  Secured,
  SecuredProperty,
  SecuredString,
} from '../../../common';

@ObjectType({
  implements: [Resource],
})
export class FieldRegion extends Resource {
  static readonly Props = keysOf<FieldRegion>();

  @Field()
  readonly name: SecuredString;

  readonly fieldZone: Secured<string>;

  readonly director: Secured<string>;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a field region'),
})
export class SecuredFieldRegion extends SecuredProperty(FieldRegion) {}
