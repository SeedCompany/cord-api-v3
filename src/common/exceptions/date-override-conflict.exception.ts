import { isNotFalsy, type NonEmptyArray } from '@seedcompany/common';
import type { ID } from '../id-field';
import { type CalendarDate } from '../temporal';
import type { Range } from '../types';
import { RangeException } from './range.exception';

type Conflict = Readonly<{
  __typename: string;
  id: ID;
  label: string;
  point: 'start' | 'end';
  date: CalendarDate;
}>;

interface IdentifiableResource {
  __typename: string;
  id: ID;
  [key: string]: unknown;
}

export class DateOverrideConflictException extends RangeException {
  constructor(
    readonly object: IdentifiableResource,
    readonly canonical: Range<CalendarDate | null>,
    label: [singular: string, plural: string],
    readonly conflicts: NonEmptyArray<Conflict>,
  ) {
    const message = [
      conflicts.length === 1
        ? `${label[0]} has a date outside the new range`
        : `${label[1]} have dates outside the new range`,
      ...conflicts.map(({ date, point, label }) => {
        const pointStr = point === 'start' ? 'Start' : 'End';
        const dateStr = date.toISO();
        return `  - ${pointStr} date of ${label} is ${dateStr}`;
      }),
    ].join('\n');
    super({ message });
  }

  static findConflicts(
    canonical: Range<CalendarDate | null>,
    items: ReadonlyArray<{
      __typename: string;
      id: ID;
      label: string;
      start: CalendarDate | null;
      end: CalendarDate | null;
    }>,
  ): NonEmptyArray<Conflict> | undefined {
    const maybeConflicts = items.flatMap<Conflict | null>(({ start, end, ...item }) => [
      canonical.start && start && canonical.start > start
        ? {
            ...item,
            point: 'start' as const,
            date: start,
          }
        : null,
      canonical.end && end && canonical.end < end
        ? {
            ...item,
            point: 'end' as const,
            date: end,
          }
        : null,
    ]);
    return asNonEmpty(maybeConflicts.filter(isNotFalsy));
  }
}

export const asNonEmpty = <T>(items: readonly T[]) =>
  items.length === 0 ? undefined : (items as NonEmptyArray<T>);
