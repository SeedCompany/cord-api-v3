import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnumList } from '../../../common';

export enum MethodologyStep {
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

registerEnumType(MethodologyStep, {
  name: 'MethodologyStep',
  description:
    'A step required to produce a product following a given methodology.',
});

@ObjectType({
  description: SecuredEnumList.descriptionFor('product steps'),
})
export class SecuredMethodologySteps extends SecuredEnumList(MethodologyStep) {}
