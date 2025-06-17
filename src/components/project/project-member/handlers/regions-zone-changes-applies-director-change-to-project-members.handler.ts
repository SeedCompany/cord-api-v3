import { EventsHandler, ILogger, Logger, ResourceLoader } from '~/core';
import { FieldRegionUpdatedEvent } from '../../../field-region/events/field-region-updated.event';
import { ProjectMemberRepository } from '../project-member.repository';

@EventsHandler(FieldRegionUpdatedEvent)
export class RegionsZoneChangesAppliesDirectorChangeToProjectMembersHandler {
  constructor(
    private readonly repo: ProjectMemberRepository,
    private readonly resources: ResourceLoader,
    @Logger('project:members') private readonly logger: ILogger,
  ) {}

  async handle(event: FieldRegionUpdatedEvent) {
    const oldZoneId = event.previous.fieldZone.id;
    const newZoneId = event.input.fieldZoneId;
    if (!newZoneId) {
      return;
    }
    const [oldZone, newZone] = await Promise.all([
      this.resources.load('FieldZone', oldZoneId),
      this.resources.load('FieldZone', newZoneId),
    ]);
    const oldDirector = oldZone.director.value;
    const newDirector = newZone.director.value;
    if (!oldDirector || !newDirector) {
      // Shouldn't really happen. I think everyone can see zones & directors rn.
      throw new Error(
        'Cannot read field zone directors to apply project membership changes',
      );
    }

    const stats = await this.repo.replaceMembershipsOnOpenProjects(
      oldDirector.id,
      newDirector.id,
      'FieldOperationsDirector',
      event.updated.id,
    );

    this.logger.notice(
      "FieldRegion's zone changed - Replaced FOD director memberships on open projects",
      {
        location: event.updated.id,
        oldZone: oldZoneId,
        newZone: newZoneId,
        oldDirector: oldDirector.id,
        newDirector: newDirector.id,
        ...stats,
      },
    );
  }
}
