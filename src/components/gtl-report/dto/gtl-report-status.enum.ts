import { ObjectType } from '@nestjs/graphql';
import { type EnumType, makeEnum, SecuredEnum } from '~/common';

/**
 * The workflow states of a GTL quarterly report.
 *
 * Deliberately its own enum rather than a reuse of `ProgressReportStatus`. The
 * two flows agree on five states but diverge on `PendingSupervisorSignOff`: the
 * FY27 narrative ends by sending the report to the leader's on-the-ground
 * supervisor for assessment, and that sign-off gates review. Adding that value
 * to the Momentum enum would surface it in Momentum's GraphQL enum, its status
 * filters and its stepper, for a state Momentum can never reach.
 *
 * `PendingTranslation` is kept: GTL narratives frequently arrive in a national
 * language, so the need is if anything stronger here than for Momentum.
 *
 * Declared in workflow order — `sortingForEnumIndex` sorts by ordinal, and the
 * DB enum `gtl_report_status` declares the same order.
 */
export type GtlReportStatus = EnumType<typeof GtlReportStatus>;
export const GtlReportStatus = makeEnum({
  name: 'GtlReportStatus',
  values: [
    'NotStarted',
    'InProgress',
    { value: 'PendingSupervisorSignOff', label: 'Pending Supervisor Sign-Off' },
    'PendingTranslation',
    'InReview',
    'Approved',
    'Published',
  ],
  exposeOrder: true,
});

@ObjectType({
  description: SecuredEnum.descriptionFor('GTL report status'),
})
export abstract class SecuredGtlReportStatus extends SecuredEnum(
  GtlReportStatus,
) {}
