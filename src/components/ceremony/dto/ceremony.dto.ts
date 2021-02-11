import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  Resource,
  SecuredBoolean,
  SecuredDate,
  SecuredProperty,
  SecuredProps,
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
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a ceremony'),
})
export class SecuredCeremony extends SecuredProperty(Ceremony) {}
