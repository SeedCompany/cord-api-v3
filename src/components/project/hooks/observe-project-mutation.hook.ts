import type { ObservableInput } from 'rxjs';
import { type ProjectMutation } from '../dto';
import { type ProjectMutationArgs } from '../project.channels';

export class ObserveProjectMutationHook {
  constructor(
    readonly args: ProjectMutationArgs,
    private readonly channels: Set<ObservableInput<ProjectMutation>>,
  ) {}

  add(channel: ObservableInput<ProjectMutation>) {
    this.channels.add(channel);
  }
}
