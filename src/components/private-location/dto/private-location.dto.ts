import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredString, Sensitivity } from '../../../common';
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
