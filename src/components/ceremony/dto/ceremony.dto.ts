import { Field, ObjectType } from '@nestjs/graphql';
import {
  Calculated,
  Resource,
  SecuredBoolean,
  SecuredBooleanNullable,
  SecuredDateNullable,
  SecuredProperty,
  Sensitivity,
  SensitivityField,
} from '~/common';
import { e } from '~/core/gel';
import { type LinkTo, RegisterResource } from '~/core/resources';
import { CeremonyType } from './ceremony-type.enum';

@RegisterResource({ db: e.Engagement.Ceremony })
@Calculated()
@ObjectType({
  implements: [Resource],
})
export class Ceremony extends Resource {
  static readonly Parent = () =>
    import('../../engagement/dto').then((m) => m.IEngagement);

  readonly engagement: LinkTo<'Engagement'>;

  @Field(() => CeremonyType)
  readonly type: CeremonyType;

  // Nullable in TS (migration 0042): 7,386 migrated ceremonies carry a kept
  // blank. The WIRE type stays `SecuredBoolean` on purpose — the schema is an
  // API-compatibility promise, and its `value` was always nullable
  // (`Boolean`, not `Boolean!`), so the blank needs no schema change.
  @Field(() => SecuredBoolean)
  readonly planned: SecuredBooleanNullable;

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
