import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DbLabel,
  Resource,
  SecuredProperty,
  SecuredProps,
  SecuredString,
  Sensitivity,
} from '../../../common';
import { Location } from '../../location/dto';

@ObjectType({
  implements: Resource,
})
export class Organization extends Resource {
  static readonly Props = keysOf<Organization>();
  static readonly SecuredProps = keysOf<SecuredProps<Organization>>();
  static readonly Relations = {
    locations: [Location],
  };

  @Field()
  @DbLabel('OrgName')
  readonly name: SecuredString;

  @Field()
  readonly address: SecuredString;

  @Field(() => Sensitivity, {
    description:
      "Based on the project's sensitivity. Usually comes from a distant affiliation with a project.",
  })
  readonly sensitivity?: Sensitivity;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('an organization'),
})
export class SecuredOrganization extends SecuredProperty(Organization) {}
