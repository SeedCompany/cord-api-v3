import { Injectable } from '@nestjs/common';
import { DateOverrideConflictException } from '~/common';
import { OnHook } from '~/core/hooks';
import { ResourcesHost } from '~/core/resources';
import { ProjectUpdatedHook } from '../../project/hooks';
import { EngagementService } from '../engagement.service';

@Injectable()
export class ValidateEngDateOverridesOnProjectChangeHandler {
  constructor(
    private readonly engagements: EngagementService,
    private readonly resources: ResourcesHost,
  ) {}

  @OnHook(ProjectUpdatedHook, -10)
  async handle(event: ProjectUpdatedHook) {
    const { updated: project, changes } = event;

    if (changes.mouStart === undefined && changes.mouEnd === undefined) {
      return;
    }

    const engagements = await this.engagements.listAllByProjectId(project.id);
    const canonical = { start: project.mouStart, end: project.mouEnd };
    const conflicts = DateOverrideConflictException.findConflicts(
      canonical,
      engagements.map((eng) => ({
        __typename: this.resources.enhance(eng.__typename).name,
        id: eng.id,
        label: (eng.label.language ?? eng.label.intern)!,
        start: eng.startDateOverride,
        end: eng.endDateOverride,
      })),
    );
    if (!conflicts) return;
    throw new DateOverrideConflictException(
      {
        __typename: event.resource.name,
        id: project.id,
        name: project.name,
      },
      canonical,
      ['An engagement', 'Some engagements'],
      conflicts,
    );
  }
}
