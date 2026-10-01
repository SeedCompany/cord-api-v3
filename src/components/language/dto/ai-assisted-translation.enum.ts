import { ObjectType } from '@nestjs/graphql';
import { type EnumType, makeEnum, SecuredEnum } from '~/common';

export type AIAssistedTranslation = EnumType<typeof AIAssistedTranslation>;
export const AIAssistedTranslation = makeEnum({
  name: 'AIAssistedTranslation',
  values: ['Unknown', 'None', 'Draft', 'Check', 'DraftAndCheck', 'Other'],
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
  description: SecuredEnum.descriptionFor('using AI assisted translation'),
})
export class SecuredAIAssistedTranslation extends SecuredEnum(
  AIAssistedTranslation,
  { nullable: true },
) {}
