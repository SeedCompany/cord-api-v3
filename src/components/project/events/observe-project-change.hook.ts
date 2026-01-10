import type { ObservableInput } from 'rxjs';
import { type AnyProjectChange } from '../dto';
import { type ProjectChangedArgs } from '../project.channels';

export class ObserveProjectChangeHook {
  constructor(
    readonly args: ProjectChangedArgs,
    private readonly channels: Set<ObservableInput<AnyProjectChange>>,
  ) {}

  add(channel: ObservableInput<AnyProjectChange>) {
    this.channels.add(channel);
  }
}
