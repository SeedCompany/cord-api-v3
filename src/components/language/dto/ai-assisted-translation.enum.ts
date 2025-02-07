import { ObjectType } from '@nestjs/graphql';
import { EnumType, makeEnum, SecuredEnum } from '~/common';

export type AIAssistedTranslation = EnumType<typeof AIAssistedTranslation>;
export const AIAssistedTranslation = makeEnum({
  name: 'AIAssistedTranslation',
  values: ['Unknown', 'None', 'Drafting', 'Checking', 'DraftCheck', 'Other'],
  exposeOrder: true,
});

@ObjectType({
  description: SecuredEnum.descriptionFor('using AI assisted translation'),
})
export class SecuredAIAssistedTranslation extends SecuredEnum(
  AIAssistedTranslation,
  {
    nullable: true,
  },
) {}
