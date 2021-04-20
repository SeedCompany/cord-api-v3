import { DateTime } from 'luxon';
import * as Neo from 'neo4j-driver';
import { inspect } from 'util';

/* eslint-disable @typescript-eslint/method-signature-style */
declare module 'luxon/src/datetime' {
  interface DateTime {
    toNeo4JDate(this: DateTime): Neo.Date<number>;
    toNeo4JDateTime(this: DateTime): Neo.DateTime<number>;
    [inspect.custom](): string;
  }
}
/* eslint-enable @typescript-eslint/method-signature-style */

DateTime.prototype.toNeo4JDate = function (this: DateTime) {
  return new Neo.types.Date(this.year, this.month, this.day);
};

DateTime.prototype.toNeo4JDateTime = function (this: DateTime) {
  return new Neo.types.DateTime(
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

DateTime.prototype[inspect.custom] = function (this: DateTime) {
  const str = this.toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS);
  return `[DateTime] ${str}`;
};
