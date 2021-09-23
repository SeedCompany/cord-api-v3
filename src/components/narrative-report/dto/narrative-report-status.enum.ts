import { registerEnumType } from '@nestjs/graphql';

export enum NarrativeReportStatus {
  Draft = 'Draft',
  InReview = 'InReview',
  Finalized = 'Finalized',
}

registerEnumType(NarrativeReportStatus, {
  name: 'NarrativeReportStatus',
});
