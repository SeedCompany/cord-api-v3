import { EngagementService } from '../../../engagement';
import { EngagementStatus } from '../../../engagement/dto';
import { TransitionCondition } from '../../../workflow/transitions/conditions';
import { ResolveParams } from './dynamic-step';

type Condition = TransitionCondition<ResolveParams>;

export const IsNotMultiplication: Condition = {
  description: 'Only if non-multiplication',
  resolve({ project }) {
    return {
      status: project.type !== 'MultiplicationTranslation' ? 'ENABLED' : 'OMIT',
    };
  },
};

export const RequireOngoingEngagementsToBeFinalizingCompletion: Condition = {
  description:
    'All engagements must be Finalizing Completion or in a terminal status',
  async resolve({ project, moduleRef }) {
    const repo = moduleRef.get(EngagementService);
    const hasOngoing = await repo.hasOngoing(project.id, [
      EngagementStatus.FinalizingCompletion,
    ]);
    return {
      status: hasOngoing ? 'DISABLED' : 'ENABLED',
      disabledReason: `The project cannot be completed since some ongoing engagements are not "Finalizing Completion"`,
    };
  },
};
