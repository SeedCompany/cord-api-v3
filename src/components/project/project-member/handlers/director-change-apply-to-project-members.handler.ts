import { type Role } from '~/common';
import { EventsHandler } from '~/core/events';
import { ILogger, Logger } from '~/core/logger';
import { FieldRegionUpdatedEvent } from '../../../field-region/events/field-region-updated.event';
import { FieldZoneUpdatedEvent } from '../../../field-zone/events/field-zone-updated.event';
import { ProjectMemberRepository } from '../project-member.repository';

@EventsHandler(FieldZoneUpdatedEvent, FieldRegionUpdatedEvent)
export class DirectorChangeApplyToProjectMembersHandler {
  constructor(
    private readonly repo: ProjectMemberRepository,
    @Logger('project:members') private readonly logger: ILogger,
  ) {}

  async handle(event: FieldZoneUpdatedEvent | FieldRegionUpdatedEvent) {
    const oldDirector = event.previous.director.id;
    const newDirector = event.input.directorId;
    if (!newDirector) {
      return;
    }
    const role: Role =
      event instanceof FieldZoneUpdatedEvent ? 'FieldOperationsDirector' : 'RegionalDirector';

    const stats = await this.repo.replaceMembershipsOnOpenProjects(oldDirector, newDirector, role);

    this.logger.notice('Replaced director memberships on open projects', {
      location: event.updated.id,
      oldDirector,
      newDirector,
      role,
      ...stats,
    });
  }
}
