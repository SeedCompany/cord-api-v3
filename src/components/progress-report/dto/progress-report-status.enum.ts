import { ObjectType } from '@nestjs/graphql';
import { type EnumType, makeEnum, SecuredEnum } from '~/common';

export type ProgressReportStatus = EnumType<typeof ProgressReportStatus>;
export const ProgressReportStatus = makeEnum({
  name: 'ProgressReportStatus',
  values: ['NotStarted', 'InProgress', 'PendingTranslation', 'InReview', 'Approved', 'Published'],
  exposeOrder: true,
});

@ObjectType()
export class SecuredProgressReportStatus extends SecuredEnum(ProgressReportStatus) {}
