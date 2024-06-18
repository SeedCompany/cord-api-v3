import { ConfigService } from '~/core';
import { TransitionNotifier } from '../../../workflow/transitions/notifiers';
import { ResolveEngagementParams } from './dynamic-step';

type Notifier = TransitionNotifier<ResolveEngagementParams>;

//delete this notifier; created just to test engagement notifiers
export const EmailDistro = (email: string): Notifier => ({
  description: email,
  resolve({ moduleRef }) {
    const config = moduleRef.get(ConfigService, { strict: false });
    if (!config.email.notifyDistributionLists) {
      return [];
    }
    return { email };
  },
});
