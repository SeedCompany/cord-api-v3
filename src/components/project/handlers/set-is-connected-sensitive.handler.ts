import { node, relation } from 'cypher-query-builder';
import { ACTIVE } from '~/core/database/query';
import { ID, Sensitivity } from '../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { ProjectCreatedEvent, ProjectUpdatedEvent } from '../events';
import { ProjectService } from '../project.service';

type SubscribedEvent = ProjectCreatedEvent | ProjectUpdatedEvent;

@EventsHandler(ProjectCreatedEvent, ProjectUpdatedEvent)
export class SetIsConnectedSensitive implements IEventHandler<SubscribedEvent> {
  constructor(
    private readonly db: DatabaseService,
    private readonly projectService: ProjectService,
    @Logger('project:set-is-connected-sensitive')
    private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Project mutation, set is connected sensitive', {
      ...event,
      event: event.constructor.name,
    });

    const project = 'project' in event ? event.project : event.updated;

    if ([Sensitivity.High, Sensitivity.Medium].includes(project.sensitivity)) {
      await this.db
        .query()
        .match([
          node('node', 'Project'),
          relation('out', '', 'member', ACTIVE),
          node('member', 'ProjectMember'),
          relation('out', '', 'user', ACTIVE),
          node('user', 'User'),
          relation('out', '', 'isConnectedToSensitive', ACTIVE),
          node('isConnectedToSensitive', 'Property'),
        ])
        .setValues({
          isConnectedToSensitive: { value: true },
        })
        .run();
    } else if (
      event instanceof ProjectUpdatedEvent &&
      event.previous.sensitivity !== project.sensitivity
    ) {
      // update all users' isConnectedToSensitive
      const users = await this.db
        .query()
        .match([
          node('node', 'Project'),
          relation('out', '', 'member', ACTIVE),
          node('member', 'ProjectMember'),
          relation('out', '', 'user', ACTIVE),
          node('user', 'User'),
        ])
        .return<{ userIds: ID[] }>('collect(user.id) as userIds')
        .first();
      await this.projectService.updateIsConnectedToSensitiveByIds(
        users?.userIds || [],
        event.session
      );
    }
  }
}
