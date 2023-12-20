import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { e } from '~/core/edgedb';
import { RegisterResource } from '~/core/resources';
import {
  Calculated,
  Resource,
  SecuredBoolean,
  SecuredDate,
  SecuredProperty,
  SecuredProps,
  Sensitivity,
  SensitivityField,
} from '../../../common';
import { CeremonyType } from './ceremony-type.enum';

@RegisterResource()
@Calculated()
@ObjectType({
  implements: [Resource],
})
export class Ceremony extends Resource {
  static readonly DB = e.Engagement.Ceremony;
  static readonly Props = keysOf<Ceremony>();
  static readonly SecuredProps = keysOf<SecuredProps<Ceremony>>();
  static readonly Parent = import('../../engagement/dto').then(
    (m) => m.IEngagement,
  );

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

declare module '~/core/resources/map' {
  interface ResourceMap {
    Ceremony: typeof Ceremony;
  }
}
