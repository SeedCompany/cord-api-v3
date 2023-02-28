import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { exposeSrcOrder, SecuredEnum } from '~/common';

export enum ProgressReportStatus {
  NotStarted = 'NotStarted',
  InProgress = 'InProgress',
  PendingTranslation = 'PendingTranslation',
  InReview = 'InReview',
  Approved = 'Approved',
  Published = 'Published',
}

registerEnumType(ProgressReportStatus, {
  name: 'ProgressReportStatus',
  valuesMap: exposeSrcOrder(ProgressReportStatus),
});

@ObjectType()
export class SecuredProgressReportStatus extends SecuredEnum(
  ProgressReportStatus,
) {}
