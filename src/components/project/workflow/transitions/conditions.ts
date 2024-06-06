import { ScopedRole } from '../../../authorization/dto';
import { EngagementService } from '../../../engagement';
import { EngagementStatus } from '../../../engagement/dto';
import { TransitionCondition } from '../../../workflow/transitions/conditions';
import { ResolveParams } from './dynamic-step';

type Condition = TransitionCondition<ResolveParams>;

export const IsNotMultiplication: Condition = {
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

export const hasValidRoleForProjectType: Condition = {
  description: 'Validate role by project type',
  resolve({ project, session }) {
    const validRoles: ScopedRole[] = [
      'global:Administrator',
      'global:Consultant',
      'global:ConsultantManager',
    ];
    const hasAtLeastOneValidRole = validRoles.some((role) =>
      session?.roles.includes(role),
    );

    switch (project.type) {
      case 'MomentumTranslation':
        return {
          status: 'ENABLED',
        };
      case 'Internship':
        return {
          status: hasAtLeastOneValidRole ? 'ENABLED' : 'OMIT',
        };
      default:
        return {
          status: 'OMIT',
        };
    }
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
