import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnum } from '../../../common';

export enum NarrativeReportStatus {
  Draft = 'Draft',
  InReview = 'InReview',
  Finalized = 'Finalized',
}

registerEnumType(NarrativeReportStatus, {
  name: 'NarrativeReportStatus',
});

@ObjectType({
  description: SecuredEnum.descriptionFor('a narrative report status'),
})
export class SecuredNarrativeReportStatus extends SecuredEnum(
  NarrativeReportStatus
) {}
