import type { ObservableInput } from 'rxjs';
import { type ProjectMemberMutation } from '../dto';
import { type ProjectMemberMutationArgs } from '../project-member.channels';

export class ObserveProjectMemberMutationHook {
  constructor(
    readonly args: ProjectMemberMutationArgs,
    private readonly channels: Set<ObservableInput<ProjectMemberMutation>>,
  ) {}

  add(channel: ObservableInput<ProjectMemberMutation>) {
    this.channels.add(channel);
  }
}
