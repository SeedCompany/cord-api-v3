import { Transformer } from 'cypher-query-builder';
import { DateTime, FixedOffsetZone } from 'luxon';
import { v1 as Neo } from 'neo4j-driver';
import {
  Date as NeoDate,
  DateTime as NeoDateTime,
} from 'neo4j-driver/types/v1';

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

export class MyTransformer extends PatchedTransformer {
  protected transformValue(value: unknown): any {
    if (isNeoDateTime(value)) {
      return this.transformDateTime(value);
    }
    if (isNeoDate(value)) {
      return this.transformDate(value);
    }

    return super.transformValue(value);
  }

  protected transformDate(date: NeoDate) {
    const plain = this.transformValue({ ...date });
    return DateTime.fromObject(plain);
  }

  protected transformDateTime(dt: NeoDateTime) {
    const plain = this.transformValue({ ...dt });
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
}
