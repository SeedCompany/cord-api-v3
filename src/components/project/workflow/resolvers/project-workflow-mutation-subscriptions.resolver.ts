import { Args, Resolver } from '@nestjs/graphql';
import { from, map, mergeMap } from 'rxjs';
import { omitNotFound$, Subscription } from '~/common';
import { OnHook } from '~/core/hooks';
import { ResourceLoader } from '~/core/resources';
import { ObserveProjectMutationHook } from '../../hooks';
import { ProjectTransitioned } from '../dto';
import {
  ProjectWorkflowChannels,
  ProjectWorkflowMutationArgs,
  type ProjectWorkflowMutationPayload,
} from '../project-workflow.channels';
import { ProjectWorkflowService } from '../project-workflow.service';

@Resolver()
export class ProjectWorkflowMutationSubscriptionsResolver {
  constructor(
    private readonly service: ProjectWorkflowService,
    private readonly channels: ProjectWorkflowChannels,
    private readonly loaders: ResourceLoader,
  ) {}

  @OnHook(ObserveProjectMutationHook)
  async observeProjectChanges(hook: ObserveProjectMutationHook) {
    hook.add(this.projectTransitioned(hook.args));
  }

  private verifyReadPermission$() {
    return mergeMap(
      <Payload extends ProjectWorkflowMutationPayload>(payload: Payload) => {
        // Omit event if the user watching doesn't have permission to view the event
        return from(
          this.loaders.load('ProjectWorkflowEvent', payload.event.id),
        ).pipe(
          omitNotFound$(),
          map(() => payload),
        );
      },
    );
  }

  @Subscription(() => ProjectTransitioned)
  projectTransitioned(@Args() args: ProjectWorkflowMutationArgs) {
    return this.channels.transitioned(args).pipe(
      this.verifyReadPermission$(),
      map(
        ({ project, event, ...rest }): ProjectTransitioned => ({
          __typename: 'ProjectTransitioned',
          projectId: project,
          event: this.service.secure(event),
          ...rest,
        }),
      ),
    );
  }
}
