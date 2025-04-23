import { isNotFalsy, NonEmptyArray } from '@seedcompany/common';
import { CalendarDate, ID, RangeException, type UnsecuredDto } from '~/common';
import { EventsHandler, IEventHandler } from '~/core';
import type { Project } from '../../project/dto';
import { ProjectUpdatedEvent } from '../../project/events';
import { EngagementService } from '../engagement.service';

@EventsHandler(ProjectUpdatedEvent)
export class ValidateEngDateOverridesOnProjectChangeHandlerSetLastStatusDate
  implements IEventHandler<ProjectUpdatedEvent>
{
  constructor(private readonly engagements: EngagementService) {}

  async handle(event: ProjectUpdatedEvent) {
    const { changes, updated, session } = event;

    if (changes.mouStart === undefined && changes.mouEnd === undefined) {
      return;
    }

    const project = {
      id: updated.id,
      name: updated.name,
      mouStart: updated.mouStart,
      mouEnd: updated.mouEnd,
    };
    const engagements = await this.engagements.listAllByProjectId(
      project.id,
      session,
    );
    const errors = engagements
      .flatMap<
        EngagementDateOverrideConflictException['engagements'][0] | null
      >((eng) => {
        const common = {
          id: eng.id,
          label: (eng.label.language ?? eng.label.intern)!,
        } as const;
        const { startDateOverride: start, endDateOverride: end } = eng;
        return [
          project.mouStart && start && project.mouStart > start
            ? {
                ...common,
                point: 'start' as const,
                date: start,
              }
            : null,
          project.mouEnd && end && project.mouEnd < end
            ? {
                ...common,
                point: 'end' as const,
                date: end,
              }
            : null,
        ];
      })
      .filter(isNotFalsy);
    if (errors.length === 0) {
      return;
    }
    throw new EngagementDateOverrideConflictException(project, [
      errors[0]!,
      ...errors.slice(1),
    ]);
  }
}

class EngagementDateOverrideConflictException extends RangeException {
  constructor(
    readonly project: Pick<
      UnsecuredDto<Project>,
      'id' | 'name' | 'mouStart' | 'mouEnd'
    >,
    readonly engagements: NonEmptyArray<
      Readonly<{
        id: ID<'Engagement'>;
        label: string;
        point: 'start' | 'end';
        date: CalendarDate;
      }>
    >,
  ) {
    const message = [
      engagements.length === 1
        ? 'An engagement has a date outside the new range'
        : 'Some engagements have dates outside the new range',
      ...engagements.map((eng) => {
        const pointStr = eng.point === 'start' ? 'Start' : 'End';
        const dateStr = eng.date.toISO();
        return `  - ${pointStr} date of ${eng.label} is ${dateStr}`;
      }),
    ].join('\n');
    super({ message });
  }
}
