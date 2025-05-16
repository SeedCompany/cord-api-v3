import { DateOverrideConflictException, EnhancedResource } from '~/common';
import { EventsHandler, type IEventHandler } from '~/core';
import { ProjectUpdatedEvent } from '../../project/events';
import { EngagementService } from '../engagement.service';

@EventsHandler(ProjectUpdatedEvent)
export class ValidateEngDateOverridesOnProjectChangeHandler
  implements IEventHandler<ProjectUpdatedEvent>
{
  constructor(private readonly engagements: EngagementService) {}

  async handle(event: ProjectUpdatedEvent) {
    const { updated: project, changes } = event;

    if (changes.mouStart === undefined && changes.mouEnd === undefined) {
      return;
    }

    const engagements = await this.engagements.listAllByProjectId(project.id);
    const canonical = { start: project.mouStart, end: project.mouEnd };
    const conflicts = DateOverrideConflictException.findConflicts(
      canonical,
      engagements.map((eng) => ({
        __typename: EnhancedResource.resolve(eng.__typename).name,
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
