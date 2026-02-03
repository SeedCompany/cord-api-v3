import { type ObservableInput } from 'rxjs';
import { type BroadcastChannel } from '~/core/broadcast';

export class BroadcastObservedHook {
  constructor(
    readonly channel: BroadcastChannel,
    // Can be mutated by hooks
    public stream: ObservableInput<unknown>,
  ) {}
}
