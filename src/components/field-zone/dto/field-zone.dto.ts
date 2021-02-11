import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  Resource,
  Secured,
  SecuredProperty,
  SecuredProps,
  SecuredString,
} from '../../../common';

@ObjectType({
  implements: [Resource],
})
export class FieldZone extends Resource {
  static readonly Props = keysOf<FieldZone>();
  static readonly SecuredProps = keysOf<SecuredProps<FieldZone>>();

  @Field()
  readonly name: SecuredString;

  readonly director: Secured<string>;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a field zone'),
})
export class SecuredFieldZone extends SecuredProperty(FieldZone) {}
