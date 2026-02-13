import { OnHook } from '~/core/hooks';
import { ILogger, Logger } from '~/core/logger';
import { ResourceLoader } from '~/core/resources';
import { FieldRegionUpdatedHook } from '../../../field-region/hooks/field-region-updated.hook';
import { ProjectMemberRepository } from '../project-member.repository';

@OnHook(FieldRegionUpdatedHook)
export class RegionsZoneChangesAppliesDirectorChangeToProjectMembersHandler {
  constructor(
    private readonly repo: ProjectMemberRepository,
    private readonly resources: ResourceLoader,
    @Logger('project:members') private readonly logger: ILogger,
  ) {}

  async handle(event: FieldRegionUpdatedHook) {
    const oldZoneId = event.previous.fieldZone.id;
    const newZoneId = event.input.fieldZone;
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
