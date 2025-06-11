import { ObjectType } from '@nestjs/graphql';
import { type EnumType, makeEnum, SecuredEnum } from '~/common';

export type AIAssistedTranslation = EnumType<typeof AIAssistedTranslation>;
export const AIAssistedTranslation = makeEnum({
  name: 'AIAssistedTranslation',
  values: ['Unknown', 'None', 'Draft', 'Check', 'DraftAndCheck', 'Other'],
  exposeOrder: true,
});

@ObjectType({
  description: SecuredEnum.descriptionFor('using AI assisted translation'),
})
export class SecuredAIAssistedTranslation extends SecuredEnum(AIAssistedTranslation, {
  nullable: true,
}) {}
