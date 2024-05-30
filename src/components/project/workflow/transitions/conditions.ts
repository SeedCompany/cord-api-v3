import { Promisable } from 'type-fest';
import { EngagementService } from '../../../engagement';
import { EngagementStatus } from '../../../engagement/dto';
import { ResolveParams } from './dynamic-step';

export interface TransitionCondition {
  description: string;
  resolve: (params: ResolveParams) => Promisable<{
    status: 'ENABLED' | 'DISABLED' | 'OMIT';
    /**
     * If not allowed, present transition anyway, as disabled,
     * and include this string explaining why.
     */
    disabledReason?: string;
  }>;
}

export const IsNotMultiplication: TransitionCondition = {
  description: 'Momentum / Internship',
  resolve({ project }: ResolveParams) {
    return {
      status: project.type !== 'MultiplicationTranslation' ? 'ENABLED' : 'OMIT',
    };
  },
};

export const IsMultiplication: TransitionCondition = {
  description: 'Multiplication',
  resolve({ project }: ResolveParams) {
    return {
      status: project.type === 'MultiplicationTranslation' ? 'ENABLED' : 'OMIT',
    };
  },
};

export const RequireOngoingEngagementsToBeFinalizingCompletion: TransitionCondition =
  {
    description:
      'All engagements must be Finalizing Completion or in a terminal status',
    async resolve({ project, moduleRef }: ResolveParams) {
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
