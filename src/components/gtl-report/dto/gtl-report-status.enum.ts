import { ObjectType } from '@nestjs/graphql';
import { type EnumType, makeEnum, SecuredEnum } from '~/common';

/**
 * The workflow states of a GTL quarterly report.
 *
 * Its own enum rather than a reuse of `ProgressReportStatus`: the two agree on
 * most states, but GTL adds `PendingSupervisorSignOff` — the report goes to the
 * leader's on-the-ground supervisor for sign-off before review — and that is a
 * state a language-engagement report can never reach. Putting it on the shared
 * enum would surface it in the ProgressReport GraphQL enum, filters and stepper.
 *
 * Declared in workflow order; the DB enum `gtl_report_status` declares the same
 * order (migration 0003).
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
