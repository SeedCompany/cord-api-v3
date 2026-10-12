import { ObjectType } from '@nestjs/graphql';
import { type EnumType, makeEnum, SecuredEnum } from '~/common';

export type LanguageMilestone = EnumType<typeof LanguageMilestone>;
export const LanguageMilestone = makeEnum({
  name: 'LanguageMilestone',
  values: ['Unknown', 'None', 'OldTestament', 'NewTestament', 'FullBible'],
  exposeOrder: true,
});

/**
 * `nullable` because only language engagements carry a value here — the
 * concept does not apply to internships, and the database now refuses one
 * there (`engagements_language_fields_shape_chk`).
 *
 * TypeScript only: the emitted `value` was already nullable, so
 * `schema.graphql` does not move.
 */
@ObjectType({
  description: SecuredEnum.descriptionFor('a language milestone'),
})
export class SecuredLanguageMilestone extends SecuredEnum(LanguageMilestone, {
  nullable: true,
}) {}
