import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  Resource,
  SecuredBoolean,
  SecuredDate,
  SecuredProperty,
  SecuredProps,
  Sensitivity,
  SensitivityField,
} from '../../../common';
import { CeremonyType } from './type.enum';

@ObjectType({
  implements: [Resource],
})
export class Ceremony extends Resource {
  static readonly Props = keysOf<Ceremony>();
  static readonly SecuredProps = keysOf<SecuredProps<Ceremony>>();

  @Field(() => CeremonyType)
  readonly type: CeremonyType;

  @Field()
  readonly planned: SecuredBoolean;

  @Field()
  readonly estimatedDate: SecuredDate;

  @Field()
  readonly actualDate: SecuredDate;

  @SensitivityField({
    description: "Based on the project's sensitivity",
  })
  readonly sensitivity: Sensitivity;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a ceremony'),
})
export class SecuredCeremony extends SecuredProperty(Ceremony) {}
