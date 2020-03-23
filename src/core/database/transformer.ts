import { Transformer } from 'cypher-query-builder';
import { DateTime, Duration, FixedOffsetZone } from 'luxon';
import { v1 as Neo } from 'neo4j-driver';
import {
  Date as NeoDate,
  DateTime as NeoDateTime,
  Duration as NeoDuration,
} from 'neo4j-driver/types/v1';
import { CalendarDate } from '../../common';

// Convert private to protected, and ignore TS complaints about that
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
class PatchedTransformer extends Transformer {
  protected transformValue(value: unknown): any {
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    return super.transformValue(value);
  }
}

export const isNeoDate = (value: unknown): value is NeoDate =>
  Neo.isDate(value as any);

export const isNeoDateTime = (value: unknown): value is NeoDateTime =>
  Neo.isDateTime(value as any);

export const isNeoDuration = (value: unknown): value is NeoDuration =>
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

  protected transformDate(date: NeoDate) {
    const plain: NeoDate<number> = this.transformValue({ ...date });
    return CalendarDate.fromObject(plain);
  }

  protected transformDateTime(dt: NeoDateTime) {
    const plain: NeoDateTime<number> = this.transformValue({ ...dt });
    const { nanosecond, timeZoneOffsetSeconds, timeZoneId, ...rest } = plain;
    const zone = timeZoneOffsetSeconds
      ? FixedOffsetZone.instance(timeZoneOffsetSeconds / 60)
      : timeZoneId;
    return DateTime.fromObject({
      ...rest,
      millisecond: nanosecond / 1e6,
      zone,
    });
  }

  private transformDuration(duration: NeoDuration) {
    const plain: NeoDuration<number> = this.transformValue({ ...duration });
    const { nanoseconds, ...rest } = plain;
    return Duration.fromObject({ ...rest, milliseconds: nanoseconds / 1e6 });
  }
}
