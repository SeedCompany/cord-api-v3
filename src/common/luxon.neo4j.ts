import { DateTime } from 'luxon';
import { v1 as Neo } from 'neo4j-driver';
import { inspect, InspectOptions } from 'util';

const { Date: NeoDate, DateTime: NeoDateTime } = Neo.types;

declare module 'luxon' {
  interface DateTime {
    toNeo4JDate: (this: DateTime) => Neo.Date<number>;
    toNeo4JDateTime: (this: DateTime) => Neo.DateTime<number>;
  }
}

// eslint-disable-next-line @typescript-eslint/unbound-method
DateTime.prototype.toNeo4JDate = function (this: DateTime) {
  return new NeoDate(this.year, this.month, this.day);
};

// eslint-disable-next-line @typescript-eslint/unbound-method
DateTime.prototype.toNeo4JDateTime = function (this: DateTime) {
  return new NeoDateTime(
    this.year,
    this.month,
    this.day,
    this.hour,
    this.minute,
    this.second,
    this.millisecond * 1e6,
    this.zone.universal ? this.offset * 60 : undefined,
    this.zone.universal ? undefined : this.zoneName
  );
};

(DateTime.prototype as any)[inspect.custom] = function (
  this: DateTime,
  depth: number,
  _options: InspectOptions
) {
  const str = this.toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS);
  return `[DateTime] ${str}`;
};
