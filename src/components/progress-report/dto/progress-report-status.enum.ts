import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnum } from '~/common';

export enum ProgressReportStatus {
  Draft = 'Draft',
  PendingTranslation = 'PendingTranslation',
  InReview = 'InReview',
  Approved = 'Approved',
  Published = 'Published',
}

registerEnumType(ProgressReportStatus, {
  name: 'ProgressReportStatus',
});

@ObjectType()
export class SecuredProgressReportStatus extends SecuredEnum(
  ProgressReportStatus
) {}
