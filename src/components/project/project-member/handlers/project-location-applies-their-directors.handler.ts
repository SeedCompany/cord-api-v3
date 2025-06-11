import { ResourceLoader } from '~/core';
import { EventsHandler } from '~/core/events';
import { ProjectUpdatedEvent } from '../../events';
import { ProjectMemberRepository } from '../project-member.repository';

@EventsHandler(ProjectUpdatedEvent)
export class ProjectLocationAppliesTheirDirectorsHandler {
  constructor(
    private readonly repo: ProjectMemberRepository,
    private readonly resources: ResourceLoader,
  ) {}

  async handle(event: ProjectUpdatedEvent) {
    const { fieldRegionId } = event.changes;
    if (!fieldRegionId) {
      return;
    }

    const fieldRegion = await this.resources.load('FieldRegion', fieldRegionId);
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
