import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  SecuredBoolean,
  SecuredDate,
  SecuredKeys,
  SecuredProperty,
} from '../../../common';
import { CeremonyType } from './type.enum';

@ObjectType({
  implements: [Resource],
})
export class Ceremony extends Resource {
  @Field(() => CeremonyType)
  readonly type: CeremonyType;

  @Field()
  readonly planned: SecuredBoolean;

  @Field()
  readonly estimatedDate: SecuredDate;

  @Field()
  readonly actualDate: SecuredDate;
}

declare module '../../authorization/policies/mapping' {
  interface TypeToDto {
    Ceremony: Ceremony;
  }
  interface TypeToSecuredProps {
    Ceremony: SecuredKeys<Ceremony>;
  }
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a ceremony'),
})
export class SecuredCeremony extends SecuredProperty(Ceremony) {}
