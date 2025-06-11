import { EngagementService } from '../../../engagement';
import { EngagementStatus } from '../../../engagement/dto';
import { type TransitionCondition } from '../../../workflow/transitions/conditions';
import { type ResolveParams } from './dynamic-step';

type Condition = TransitionCondition<ResolveParams>;

export const IsMomentumInternship: Condition = {
  description: 'Momentum / Internship',
  resolve({ project }) {
    return {
      status: project.type !== 'MultiplicationTranslation' ? 'ENABLED' : 'OMIT',
    };
  },
};

export const IsMultiplication: Condition = {
  description: 'Multiplication',
  resolve({ project }) {
    return {
      status: project.type === 'MultiplicationTranslation' ? 'ENABLED' : 'OMIT',
    };
  },
};

export const HasEngagement: Condition = {
  description: 'Has an engagement',
  resolve({ project }) {
    return {
      status: project.engagementTotal > 0 ? 'ENABLED' : 'DISABLED',
      disabledReason: `Create an engagement first`,
    };
  },
};

export const RequireOngoingEngagementsToBeFinalizingCompletion: Condition = {
  description: 'All engagements must be Finalizing Completion or in a terminal status',
  async resolve({ project, moduleRef }) {
    const repo = moduleRef.get(EngagementService, { strict: false });
    const hasOngoing = await repo.hasOngoing(project.id, [EngagementStatus.FinalizingCompletion]);
    return {
      status: hasOngoing ? 'DISABLED' : 'ENABLED',
      disabledReason: `The project cannot be completed since some ongoing engagements are not "Finalizing Completion"`,
    };
  },
};
