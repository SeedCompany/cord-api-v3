import {
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../../core';
import { ProjectService } from '../../project.service';
import {
  ProjectMemberCreatedEvent,
  ProjectMemberDeletedEvent,
} from '../events';

type SubscribedEvent = ProjectMemberCreatedEvent | ProjectMemberDeletedEvent;

@EventsHandler(ProjectMemberCreatedEvent, ProjectMemberDeletedEvent)
export class SetIsConnectedSensitive implements IEventHandler<SubscribedEvent> {
  constructor(
    private readonly projectService: ProjectService,
    @Logger('project-member:set-is-connected-sensitive')
    private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Project member mutation, set is connected sensitive', {
      ...event,
      event: event.constructor.name,
    });

    const projectMember = event.projectMember;
    if (projectMember.user.value?.id) {
      await this.projectService.updateIsConnectedToSensitiveByIds(
        [projectMember.user.value.id],
        event.session
      );
    }
  }
}
