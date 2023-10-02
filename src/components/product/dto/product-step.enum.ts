import { ObjectType } from '@nestjs/graphql';
import { EnumType, makeEnum, SecuredEnumList } from '~/common';

export type ProductStep = EnumType<typeof ProductStep>;
export const ProductStep = makeEnum({
  name: 'ProductStep',
  description: 'A step required to complete a product/"goal".',
  values: [
    'ExegesisAndFirstDraft',
    'TeamCheck',
    'CommunityTesting',
    'BackTranslation',
    'ConsultantCheck',
    'InternalizationAndDrafting',
    'PeerRevision',
    'ConsistencyCheckAndFinalEdits',
    'Craft',
    'Test',
    'Check',
    'Record',
    'Develop',
    'Translate',
    'Completed',
  ],
});

@ObjectType({
  description: SecuredEnumList.descriptionFor('product steps'),
})
export class SecuredProductSteps extends SecuredEnumList(ProductStep) {}
