import {
  DateObject,
  DateObjectUnits,
  DateTime,
  DateTimeJSOptions,
  DateTimeOptions,
  Duration,
  DurationObject,
  DurationUnit,
  LocaleOptions,
  ToISOTimeOptions,
  Zone,
  ZoneOptions,
} from 'luxon';
import { inspect } from 'util';

/**
 * Calendar Dates have no times or timezones.
 *
 * The main goal of this is to provide an independent Luxon DateTime-like object.
 *
 * Whether or not we need/want it to be type compatible with DateTime has yet to
 * be determined - currently it is.
 */
export class CalendarDate extends DateTime {
  static isDate(o: any): o is CalendarDate {
    return o instanceof CalendarDate;
  }

  static fromDateTime(dt: DateTime): CalendarDate {
    return Object.assign(
      new CalendarDate(),
      dt instanceof CalendarDate ? dt : dt.startOf('day')
    );
  }

  protected constructor() {
    // @ts-expect-error DateTime constructor isn't defined, because it's private
    // but it does require an object
    super({});
  }

  toISO(_options?: ToISOTimeOptions): string {
    return this.toISODate();
  }

  static fromHTTP(text: string, options?: DateTimeOptions): CalendarDate {
    return CalendarDate.fromDateTime(super.fromHTTP(text, options));
  }

  static fromISO(text: string, options?: DateTimeOptions): CalendarDate {
    return CalendarDate.fromDateTime(super.fromISO(text, options));
  }

  static fromJSDate(date: Date, options?: DateTimeJSOptions): CalendarDate {
    return CalendarDate.fromDateTime(super.fromJSDate(date, options));
  }

  static fromMillis(ms: number, options?: DateTimeOptions): CalendarDate {
    return CalendarDate.fromDateTime(super.fromMillis(ms, options));
  }

  static fromObject(obj: DateObject): CalendarDate {
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
    opts?: DateTimeOptions
  ): CalendarDate {
    return CalendarDate.fromDateTime(super.fromFormat(text, format, opts));
  }

  static invalid(reason: any): CalendarDate {
    return CalendarDate.fromDateTime(super.invalid(reason));
  }

  static local(year?: number, month?: number, day?: number): CalendarDate {
    return CalendarDate.fromDateTime(super.local(year, month, day));
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

  static utc(year?: number, month?: number, day?: number): CalendarDate {
    return CalendarDate.fromDateTime(super.utc(year, month, day));
  }

  endOf(unit: DurationUnit): CalendarDate {
    return CalendarDate.fromDateTime(super.endOf(unit));
  }

  minus(duration: Duration | number | DurationObject): CalendarDate {
    return CalendarDate.fromDateTime(super.minus(duration));
  }

  plus(duration: Duration | number | DurationObject): CalendarDate {
    return CalendarDate.fromDateTime(super.plus(duration));
  }

  reconfigure(properties: LocaleOptions): CalendarDate {
    return CalendarDate.fromDateTime(super.reconfigure(properties));
  }

  set(values: DateObjectUnits): CalendarDate {
    return CalendarDate.fromDateTime(super.set(values));
  }

  setLocale(locale: string): CalendarDate {
    return CalendarDate.fromDateTime(super.setLocale(locale));
  }

  setZone(_zone: string | Zone, _options?: ZoneOptions): CalendarDate {
    return this; // noop
  }

  startOf(unit: DurationUnit): CalendarDate {
    return CalendarDate.fromDateTime(super.startOf(unit));
  }

  toLocal(): CalendarDate {
    return this; // noop
  }

  toUTC(): CalendarDate {
    return this; // noop
  }
}

(CalendarDate.prototype as any)[inspect.custom] = function (
  this: CalendarDate
) {
  const str = this.toLocaleString(DateTime.DATE_SHORT);
  return `[Date] ${str}`;
};
