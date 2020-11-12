import { difference } from 'lodash';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { AuthorizationService } from '../../authorization/authorization.service';
import { ProjectMemberUpdatedEvent, UserUpdatedEvent } from '../events';

type SubscribedEvent = UserUpdatedEvent | ProjectMemberUpdatedEvent;

@EventsHandler(UserUpdatedEvent, ProjectMemberUpdatedEvent)
export class UserProjectMemberRoles implements IEventHandler<SubscribedEvent> {
  constructor(
    private readonly db: DatabaseService,
    private readonly authorizationService: AuthorizationService,
    @Logger('user:user-project-member-roles') private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug(
      'User/ProjectMember roles updated, remove correct powers and permissions',
      {
        ...event,
        event: event.constructor.name,
      }
    );

    const removedRoles = difference(
      event.previous.roles.value,
      event.updated.roles.value
    );
    if (removedRoles.length === 0) {
      return;
    }

    // remove correct powers and permissions
    await this.authorizationService.roleDeletedFromUser(
      event.updated.id,
      removedRoles
    );
  }
}
