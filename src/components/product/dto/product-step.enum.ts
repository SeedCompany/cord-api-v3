import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnumList } from '../../../common';

export enum ProductStep {
  ExegesisAndFirstDraft = 'ExegesisAndFirstDraft',
  TeamCheck = 'TeamCheck',
  CommunityTesting = 'CommunityTesting',
  BackTranslation = 'BackTranslation',
  ConsultantCheck = 'ConsultantCheck',
  InternalizationAndDrafting = 'InternalizationAndDrafting',
  PeerRevision = 'PeerRevision',
  ConsistencyCheckAndFinalEdits = 'ConsistencyCheckAndFinalEdits',
  Craft = 'Craft',
  Test = 'Test',
  Check = 'Check',
  Record = 'Record',
  Develop = 'Develop',
  Translate = 'Translate',
  Completed = 'Completed',
}

registerEnumType(ProductStep, {
  name: 'ProductStep',
  description: 'A step required to complete a product/"goal".',
});

@ObjectType({
  description: SecuredEnumList.descriptionFor('product steps'),
})
export class SecuredProductSteps extends SecuredEnumList(ProductStep) {}
