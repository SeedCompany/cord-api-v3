import { ObjectType } from '@nestjs/graphql';
import { EnumType, makeEnum, SecuredEnum } from '~/common';

export type LanguageMilestone = EnumType<typeof LanguageMilestone>;
export const LanguageMilestone = makeEnum({
  name: 'LanguageMilestone',
  values: ['Unknown', 'None', 'OldTestament', 'NewTestament', 'FullBible'],
});

@ObjectType({
  description: SecuredEnum.descriptionFor('a language milestone'),
})
export class SecuredLanguageMilestone extends SecuredEnum(LanguageMilestone, {
  nullable: true,
}) {}
