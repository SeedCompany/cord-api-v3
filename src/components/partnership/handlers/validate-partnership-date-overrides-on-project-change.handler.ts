import { DateOverrideConflictException } from '~/common';
import { EventsHandler, IEventHandler } from '~/core';
import { ProjectUpdatedEvent } from '../../project/events';
import { PartnershipService } from '../partnership.service';

@EventsHandler(ProjectUpdatedEvent)
export class ValidatePartnershipDateOverridesOnProjectChangeHandler
  implements IEventHandler<ProjectUpdatedEvent>
{
  constructor(private readonly partnerships: PartnershipService) {}

  async handle(event: ProjectUpdatedEvent) {
    const { updated: project, changes, session } = event;

    if (changes.mouStart === undefined && changes.mouEnd === undefined) {
      return;
    }

    const canonical = { start: project.mouStart, end: project.mouEnd };
    const partnerships = await this.partnerships.listAllByProjectId(
      project.id,
      session,
    );
    const conflicts = DateOverrideConflictException.findConflicts(
      canonical,
      partnerships.map((partnership) => ({
        __typename: 'Partnership',
        id: partnership.id,
        label: partnership.id, // TODO
        start: partnership.mouStartOverride,
        end: partnership.mouEndOverride,
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
      ['A partnership', 'Some partnerships'],
      conflicts,
    );
  }
}
