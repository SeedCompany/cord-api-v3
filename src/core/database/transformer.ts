import { Transformer } from 'cypher-query-builder';
import { DateTime, Duration, FixedOffsetZone } from 'luxon';
import * as Neo from 'neo4j-driver';
import { CalendarDate } from '../../common';

// @ts-expect-error Convert private methods to protected
class PatchedTransformer extends Transformer {
  protected transformValue(value: unknown): any {
    // @ts-expect-error ignore the fact that it's private
    return super.transformValue(value);
  }
}

export const isNeoDate = (value: unknown): value is Neo.Date =>
  Neo.isDate(value as any);

export const isNeoDateTime = (value: unknown): value is Neo.DateTime =>
  Neo.isDateTime(value as any);

export const isNeoDuration = (value: unknown): value is Neo.Duration =>
  Neo.isDuration(value as any);

export class MyTransformer extends PatchedTransformer {
  protected transformValue(value: unknown): any {
    if (isNeoDateTime(value)) {
      return this.transformDateTime(value);
    }
    if (isNeoDate(value)) {
      return this.transformDate(value);
    }
    if (isNeoDuration(value)) {
      return this.transformDuration(value);
    }

    return super.transformValue(value);
  }

  protected transformDate(date: Neo.Date) {
    const plain: Neo.Date<number> = this.transformValue({ ...date });
    return CalendarDate.fromObject(plain);
  }

  protected transformDateTime(dt: Neo.DateTime) {
    const plain: Neo.DateTime<number> = this.transformValue({ ...dt });
    const { nanosecond, timeZoneOffsetSeconds, timeZoneId, ...rest } = plain;
    const zone =
      timeZoneOffsetSeconds != null
        ? FixedOffsetZone.instance(timeZoneOffsetSeconds / 60)
        : timeZoneId;
    return DateTime.fromObject(
      {
        ...rest,
        millisecond: nanosecond / 1e6,
      },
      {
        zone,
      }
    );
  }

  private transformDuration(duration: Neo.Duration) {
    const plain: Neo.Duration<number> = this.transformValue({ ...duration });
    const { nanoseconds, ...rest } = plain;
    return Duration.fromObject({ ...rest, milliseconds: nanoseconds / 1e6 });
  }
}
