import { TransitionCondition } from '../../../workflow/transitions/conditions';
import { ResolveEngagementParams } from './dynamic-step';

type Condition = TransitionCondition<ResolveEngagementParams>;

//delete this condition; created just to test engagement conditions
export const IsInternship: Condition = {
  description: 'Internship',
  resolve({ engagement }) {
    return {
      status:
        engagement.__typename !== 'InternshipEngagement' ? 'ENABLED' : 'OMIT',
    };
  },
};
