import { ResourceLoader } from '~/core';
import { OnHook } from '~/core/hooks';
import { ProjectUpdatedHook } from '../../hooks';
import { ProjectMemberRepository } from '../project-member.repository';

@OnHook(ProjectUpdatedHook)
export class ProjectRegionDefaultsDirectorMembershipHandler {
  constructor(
    private readonly repo: ProjectMemberRepository,
    private readonly resources: ResourceLoader,
  ) {}

  async handle(event: ProjectUpdatedHook) {
    const { changes } = event;
    if (!changes.fieldRegion) {
      return;
    }

    const fieldRegion = await this.resources.load(
      'FieldRegion',
      changes.fieldRegion,
    );
    if (fieldRegion.director.value) {
      await this.repo.addDefaultForRole(
        'RegionalDirector',
        event.updated.id,
        fieldRegion.director.value.id,
      );
    }

    if (fieldRegion.fieldZone.value) {
      const fieldZone = await this.resources.load(
        'FieldZone',
        fieldRegion.fieldZone.value.id,
      );
      if (fieldZone.director.value) {
        await this.repo.addDefaultForRole(
          'FieldOperationsDirector',
          event.updated.id,
          fieldZone.director.value.id,
        );
      }
    }
  }
}
