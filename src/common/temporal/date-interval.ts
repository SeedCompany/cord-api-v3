import { setInspectOnClass, setToStringTag } from '@seedcompany/common';
import {
  DateInput,
  DateTimeOptions,
  DateTimeUnit,
  Duration,
  DurationLike,
  DurationUnit,
  DurationUnits,
  Interval,
  IntervalObject,
} from 'luxon';
import { CalendarDate } from './calendar-date';
import '@seedcompany/common/temporal/luxon';

const toSuper = (int: DateInterval): Interval =>
  Interval.fromDateTimes(int.start, int.end.plus({ days: 1 }));

const fromSuper = (int: Interval): DateInterval =>
  DateInterval.fromDateTimes(int.start, int.end.minus({ days: 1 }));

/**
 * An Interval for dates.
 * Unlike the Luxon counterpart, this is a closed interval,
 * meaning its inclusive of both it's starting & ending date.
 * Luxon's Interval is half-open with it's end point not inclusive.
 */
export class DateInterval
  // @ts-expect-error library doesn't explicitly support extension
  extends Interval
{
  get end(): CalendarDate {
    return super.end;
  }
  get start(): CalendarDate {
    return super.start;
  }

  protected constructor(config: Required<IntervalObject>) {
    config.start = CalendarDate.isDate(config.start)
      ? config.start
      : CalendarDate.fromDateTime(config.start);
    config.end = CalendarDate.isDate(config.end)
      ? config.end
      : CalendarDate.fromDateTime(config.end);
    super(config);
  }

  static fromInterval(dateTime: Interval) {
    return new DateInterval({
      start: dateTime.start,
      end: dateTime.end,
    });
  }
  static asInterval(interval: DateInterval): Interval {
    if (!(interval instanceof DateInterval)) return interval;
    const s = CalendarDate.asDateTime(interval.start);
    const e = CalendarDate.asDateTime(interval.end);
    return Object.assign(Object.create(Interval.prototype), interval, { s, e });
  }

  static after(start: DateInput, duration: DurationLike) {
    const dur = Duration.from(duration).minus({ days: 1 });
    return DateInterval.fromInterval(super.after(start, dur));
  }
  static before(end: DateInput, duration: DurationLike) {
    const dur = Duration.from(duration).minus({ days: 1 });
    return DateInterval.fromInterval(super.before(end, dur));
  }
  static fromDateTimes(start: DateInput, end: DateInput) {
    const range = Interval.fromDateTimes(start, end);
    return new DateInterval({ start: range.start, end: range.end });
  }
  static fromObject({ start, end }: { start: DateInput; end: DateInput }) {
    const range = Interval.fromDateTimes(start, end);
    return new DateInterval({ start: range.start, end: range.end });
  }
  static fromISO(string: string, options?: DateTimeOptions) {
    return DateInterval.fromInterval(super.fromISO(string, options));
  }
  static merge(intervals: DateInterval[]) {
    return super.merge(intervals.map(toSuper)).map(fromSuper);
  }
  static xor(intervals: DateInterval[]) {
    return super.xor(intervals.map(toSuper)).map(fromSuper);
  }

  static tryFrom(start: CalendarDate, end: CalendarDate): DateInterval;
  static tryFrom(
    start: CalendarDate | null | undefined,
    end: CalendarDate | null | undefined,
  ): DateInterval | null;
  static tryFrom(
    start: CalendarDate | null | undefined,
    end: CalendarDate | null | undefined,
  ): DateInterval | null {
    return start && end ? DateInterval.fromDateTimes(start, end) : null;
  }

  abutsStart(other: DateInterval): boolean {
    return toSuper(this).abutsStart(toSuper(other));
  }
  abutsEnd(other: DateInterval): boolean {
    return toSuper(this).abutsEnd(toSuper(other));
  }
  isEmpty(): boolean {
    // Start & end points are inclusive, so this can never be empty.
    // Even if they are the same "value" (day), that's a full day.
    return false;
  }
  contains(date: CalendarDate): boolean {
    return toSuper(this).contains(date);
  }
  count(unit: DurationUnit = 'days'): number {
    return toSuper(this).count(unit);
  }
  isAfter(date: CalendarDate): boolean {
    return toSuper(this).isAfter(date);
  }
  isBefore(date: CalendarDate): boolean {
    return toSuper(this).isBefore(date);
  }
  overlaps(other: DateInterval): boolean {
    return toSuper(this).overlaps(toSuper(other));
  }
  equals(other: DateInterval): boolean {
    return super.equals(other);
  }
  engulfs(other: DateInterval): boolean {
    return super.engulfs(other);
  }
  difference(...intervals: DateInterval[]): DateInterval[] {
    return DateInterval.xor([this, ...intervals])
      .map((i) => this.intersection(i))
      .filter((i): i is DateInterval => i != null);
  }
  divideEqually(_numberOfParts: number): DateInterval[] {
    throw new Error('Dates cannot be divide equally');
  }
  intersection(other: DateInterval) {
    const int = toSuper(this).intersection(toSuper(other));
    return int && int.end > int.start ? fromSuper(int) : null;
  }
  set(values: Partial<Record<'start' | 'end', CalendarDate>>) {
    return DateInterval.fromDateTimes(
      values.start ?? this.start,
      values.end ?? this.end,
    );
  }
  splitAt(...dates: CalendarDate[]) {
    return toSuper(this)
      .splitAt(...dates)
      .map(fromSuper);
  }
  splitBy(duration: DurationLike) {
    return toSuper(this).splitBy(duration).map(fromSuper);
  }
  union(other: DateInterval) {
    return fromSuper(toSuper(this).union(toSuper(other)));
  }
  mapEndpoints(mapFn: (d: CalendarDate) => CalendarDate) {
    return DateInterval.fromDateTimes(mapFn(this.start), mapFn(this.end));
  }
  length(unit: DurationUnit = 'days'): number {
    return toSuper(this).length(unit);
  }
  toDuration(unit?: DurationUnits): Duration {
    return toSuper(this).toDuration(unit ?? ['days']);
  }
  toISO() {
    return super.toISODate();
  }
  toISOTime(): string {
    throw new Error('Nope');
  }
  toString(): string {
    return `[${this.start.toISO()} – ${this.end.toISO()}]`;
  }
  expandToFull(unit: DateTimeUnit): DateInterval {
    return DateInterval.fromDateTimes(
      this.start.startOf(unit),
      this.end.endOf(unit),
    );
  }
}

setInspectOnClass(DateInterval, (i) => ({ collapsed }) => {
  return collapsed(`${format(i.start)} – ${format(i.end)}`, 'Dates');
});
const format = (date: CalendarDate) =>
  date.toLocaleString(CalendarDate.DATE_SHORT);

setToStringTag(DateInterval, 'DateInterval');
