import {
  DateObjectUnits,
  DateTime,
  DateTimeJSOptions,
  DateTimeOptions,
  DateTimeUnit,
  DurationLike,
  FixedOffsetZone,
  LocaleOptions,
  ToISOTimeOptions,
  Zone,
  ZoneOptions,
} from 'luxon';
import type { DefaultValidity, IfValid } from 'luxon/src/_util';
import { inspect } from 'util';
import { DateInterval } from './date-interval';

/**
 * Calendar Dates have no times or timezones.
 *
 * The main goal of this is to provide an independent Luxon DateTime-like object.
 *
 * Whether or not we need/want it to be type compatible with DateTime has yet to
 * be determined - currently it is.
 */
export class CalendarDate<IsValid extends boolean = DefaultValidity>
  // @ts-expect-error library doesn't explicitly support extension
  extends DateTime<IsValid>
{
  static isDate(o: any): o is CalendarDate {
    return o instanceof CalendarDate;
  }

  static fromDateTime<IsValid extends boolean>(
    dt: DateTime<IsValid>,
  ): CalendarDate<IsValid> {
    return Object.assign(
      new CalendarDate<IsValid>(),
      dt instanceof CalendarDate ? dt : dt.startOf('day'),
    );
  }
  static asDateTime(date: CalendarDate): DateTime {
    if (!(date instanceof CalendarDate)) return date;
    return Object.assign(Object.create(DateTime.prototype), date);
  }

  protected constructor() {
    super({});
  }

  toISO(_options?: ToISOTimeOptions) {
    return this.toISODate();
  }

  static fromHTTP(text: string, options?: DateTimeOptions): CalendarDate {
    return CalendarDate.fromDateTime(super.fromHTTP(text, options));
  }

  static fromISO(text: string, options?: DateTimeOptions): CalendarDate {
    return CalendarDate.fromDateTime(super.fromISO(text, options));
  }

  static fromJSDate(date: Date, options?: DateTimeJSOptions): CalendarDate {
    const d = super
      .fromJSDate(date, options)
      // Undo the conversion to the local timezone and restore the original one
      // This way pulling the year/month/day below ignores timezone differences.
      .setZone(FixedOffsetZone.instance(date.getTimezoneOffset()));
    return CalendarDate.local(d.year, d.month, d.day);
  }

  static fromMillis(ms: number, options?: DateTimeOptions): CalendarDate {
    return CalendarDate.fromDateTime(super.fromMillis(ms, options));
  }

  static fromObject(obj: DateObjectUnits): CalendarDate {
    return CalendarDate.fromDateTime(super.fromObject(obj));
  }

  static fromRFC2822(text: string, options?: DateTimeOptions): CalendarDate {
    return CalendarDate.fromDateTime(super.fromRFC2822(text, options));
  }

  static fromSeconds(seconds: number, options?: DateTimeOptions): CalendarDate {
    return CalendarDate.fromDateTime(super.fromSeconds(seconds, options));
  }

  static fromSQL(text: string, options?: DateTimeOptions): CalendarDate {
    return CalendarDate.fromDateTime(super.fromSQL(text, options));
  }

  static fromFormat(
    text: string,
    format: string,
    opts?: DateTimeOptions,
  ): CalendarDate {
    return CalendarDate.fromDateTime(super.fromFormat(text, format, opts));
  }

  static invalid(reason: any) {
    return CalendarDate.fromDateTime(super.invalid(reason));
  }

  static now() {
    return CalendarDate.local();
  }

  static local(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
    millisecond: number,
    opts?: DateTimeJSOptions,
  ): CalendarDate;
  static local(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
    opts?: DateTimeJSOptions,
  ): CalendarDate;
  static local(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    opts?: DateTimeJSOptions,
  ): CalendarDate;
  static local(
    year: number,
    month: number,
    day: number,
    hour: number,
    opts?: DateTimeJSOptions,
  ): CalendarDate;
  static local(
    year: number,
    month: number,
    day: number,
    opts?: DateTimeJSOptions,
  ): CalendarDate;
  static local(
    year: number,
    month: number,
    opts?: DateTimeJSOptions,
  ): CalendarDate;
  static local(year: number, opts?: DateTimeJSOptions): CalendarDate;
  static local(opts?: DateTimeJSOptions): CalendarDate;
  static local(...args: any) {
    const dt = super.local(...args);
    return CalendarDate.fromDateTime(dt);
  }

  static max(): undefined;
  static max(...dateTimes: DateTime[]): CalendarDate;
  static max(...dateTimes: DateTime[]): CalendarDate | undefined {
    return CalendarDate.fromDateTime(super.max(...dateTimes));
  }

  static min(): undefined;
  static min(...dateTimes: DateTime[]): CalendarDate;
  static min(...dateTimes: DateTime[]): CalendarDate | undefined {
    return CalendarDate.fromDateTime(super.min(...dateTimes));
  }

  static utc(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
    millisecond: number,
    options?: LocaleOptions,
  ): DateTime;
  static utc(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
    options?: LocaleOptions,
  ): DateTime;
  static utc(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    options?: LocaleOptions,
  ): DateTime;
  static utc(
    year: number,
    month: number,
    day: number,
    hour: number,
    options?: LocaleOptions,
  ): DateTime;
  static utc(
    year: number,
    month: number,
    day: number,
    options?: LocaleOptions,
  ): DateTime;
  static utc(year: number, month: number, options?: LocaleOptions): DateTime;
  static utc(year: number, options?: LocaleOptions): DateTime;
  static utc(options?: LocaleOptions): DateTime;
  static utc(...args: any) {
    return CalendarDate.fromDateTime(super.utc(...args));
  }

  until(other: CalendarDate): IfValid<DateInterval, DateTime<false>, IsValid> {
    return DateInterval.fromDateTimes(this as DateTime, other) as IfValid<
      DateInterval,
      DateTime<false>,
      IsValid
    >;
  }

  endOf(unit: DateTimeUnit): this {
    return CalendarDate.fromDateTime(super.endOf(unit) as DateTime) as this;
  }

  minus(duration: DurationLike): this {
    return CalendarDate.fromDateTime(super.minus(duration) as DateTime) as this;
  }

  plus(duration: DurationLike): this {
    return CalendarDate.fromDateTime(super.plus(duration) as DateTime) as this;
  }

  reconfigure(properties: LocaleOptions): this {
    return CalendarDate.fromDateTime(
      super.reconfigure(properties) as DateTime,
    ) as this;
  }

  set(values: DateObjectUnits): this {
    return CalendarDate.fromDateTime(super.set(values) as DateTime) as this;
  }

  setLocale(locale: string): this {
    return CalendarDate.fromDateTime(
      super.setLocale(locale) as DateTime,
    ) as this;
  }

  setZone(_zone: string | Zone, _options?: ZoneOptions): CalendarDate {
    return this as CalendarDate; // noop
  }

  startOf(unit: DateTimeUnit): this {
    return CalendarDate.fromDateTime(super.startOf(unit) as DateTime) as this;
  }

  toLocal() {
    return this; // noop
  }

  toUTC() {
    return this; // noop
  }

  toPostgres() {
    return this.toSQLDate()!;
  }

  [inspect.custom]() {
    const str = this.toLocaleString(DateTime.DATE_SHORT);
    return `[Date] ${str}`;
  }
}
