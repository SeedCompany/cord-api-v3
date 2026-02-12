import { type Role } from '~/common';
import { OnHook } from '~/core/hooks';
import { ILogger, Logger } from '~/core/logger';
import { FieldRegionUpdatedHook } from '../../../field-region/hooks/field-region-updated.hook';
import { FieldZoneUpdatedHook } from '../../../field-zone/hooks/field-zone-updated.hook';
import { ProjectMemberRepository } from '../project-member.repository';

@OnHook(FieldZoneUpdatedHook)
@OnHook(FieldRegionUpdatedHook)
export class DirectorChangeApplyToProjectMembersHandler {
  constructor(
    private readonly repo: ProjectMemberRepository,
    @Logger('project:members') private readonly logger: ILogger,
  ) {}

  async handle(event: FieldZoneUpdatedHook | FieldRegionUpdatedHook) {
    const oldDirector = event.previous.director.id;
    const newDirector = event.input.director;
    if (!newDirector) {
      return;
    }
    const role: Role =
      event instanceof FieldZoneUpdatedHook
        ? 'FieldOperationsDirector'
        : 'RegionalDirector';

    const stats = await this.repo.replaceMembershipsOnOpenProjects(
      oldDirector,
      newDirector,
      role,
    );

    this.logger.notice('Replaced director memberships on open projects', {
      location: event.updated.id,
      oldDirector,
      newDirector,
      role,
      ...stats,
    });
  }
}
