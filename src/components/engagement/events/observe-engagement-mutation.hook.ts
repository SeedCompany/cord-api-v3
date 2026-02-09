import type { ObservableInput } from 'rxjs';
import { type EngagementMutation } from '../dto';
import { type EngagementMutationArgs } from '../engagement.channels';

export class ObserveEngagementMutationHook {
  constructor(
    readonly args: EngagementMutationArgs,
    private readonly channels: Set<ObservableInput<EngagementMutation>>,
  ) {}

  add(channel: ObservableInput<EngagementMutation>) {
    this.channels.add(channel);
  }
}
