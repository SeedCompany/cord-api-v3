import { Identity } from '~/core/authentication';
import { type TransitionCondition } from '../../../workflow/transitions/conditions';
import { GtlReportWorkflowRepository } from '../gtl-report-workflow.repository';
import { type ResolveParams } from './context';

type Condition = TransitionCondition<ResolveParams>;

/**
 * Supervisor sign-off has to come from someone other than the person who asked
 * for it.
 *
 * The sender is whoever's event last moved the report into
 * PendingSupervisorSignOff — found by status rather than by transition key, so
 * an administrator who bypassed the workflow into that state counts as the
 * sender too. An event attributed to a system agent names no person, so it
 * restricts nobody.
 *
 * DISABLED rather than OMIT: the sender should see the transition greyed out
 * with the reason, not wonder where it went. `findTransition` refuses a
 * disabled transition on execute, so this is enforced, not advisory.
 */
export const NotTheSender: Condition = {
  description: 'Not the user who sent the report to the supervisor',
  async resolve({ report, moduleRef }) {
    const actor = moduleRef.get(Identity, { strict: false }).current.actor;
    if (actor.type !== 'user') {
      return { status: 'ENABLED' };
    }
    const repo = moduleRef.get(GtlReportWorkflowRepository, { strict: false });
    const sender = await repo.lastSentToSupervisorBy(report.id);
    if (sender && sender === actor.id) {
      return {
        status: 'DISABLED',
        disabledReason:
          'You sent this report to the supervisor; another project member must sign off.',
      };
    }
    return { status: 'ENABLED' };
  },
};
