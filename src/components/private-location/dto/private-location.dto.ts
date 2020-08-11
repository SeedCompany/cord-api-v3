import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  SecuredProperty,
  SecuredString,
  Sensitivity,
} from '../../../common';
import { PrivateLocationType } from './private-location-type.enum';

@ObjectType({
  implements: [Resource],
})
export class PrivateLocation extends Resource {
  @Field()
  readonly name: SecuredString;

  @Field()
  readonly publicName: SecuredString;

  @Field(() => Sensitivity)
  readonly sensitivity: Sensitivity;

  @Field(() => PrivateLocationType)
  readonly type: PrivateLocationType;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a private location'),
})
export class SecuredPrivateLocation extends SecuredProperty(PrivateLocation) {}
