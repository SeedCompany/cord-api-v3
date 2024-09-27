import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  Calculated,
  Resource,
  SecuredBoolean,
  SecuredDateNullable,
  SecuredProperty,
  SecuredProps,
  Sensitivity,
  SensitivityField,
} from '~/common';
import { e } from '~/core/edgedb';
import { RegisterResource } from '~/core/resources';
import { CeremonyType } from './ceremony-type.enum';

@RegisterResource({ db: e.Engagement.Ceremony })
@Calculated()
@ObjectType({
  implements: [Resource],
})
export class Ceremony extends Resource {
  static readonly Props = keysOf<Ceremony>();
  static readonly SecuredProps = keysOf<SecuredProps<Ceremony>>();
  static readonly Parent = () =>
    import('../../engagement/dto').then((m) => m.IEngagement);

  @Field(() => CeremonyType)
  readonly type: CeremonyType;

  @Field()
  readonly planned: SecuredBoolean;

  @Field()
  readonly estimatedDate: SecuredDateNullable;

  @Field()
  readonly actualDate: SecuredDateNullable;

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
  interface ResourceDBMap {
    Ceremony: typeof e.Engagement.Ceremony;
  }
}
