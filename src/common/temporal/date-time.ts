import { setInspectOnClass } from '@seedcompany/common';
import { DateTime } from 'luxon';
import * as Neo from 'neo4j-driver';

/* eslint-disable @typescript-eslint/method-signature-style */
declare module 'luxon/src/datetime' {
  interface DateTime {
    toNeo4JDate(this: DateTime): Neo.Date<number>;
    toNeo4JDateTime(this: DateTime): Neo.DateTime<number>;
    toPostgres(this: DateTime): string;

    // Compatibility with Gel's LocalDate which is a subset of Temporal.PlainDate
    get dayOfWeek(): number;
    get dayOfYear(): number;
    get daysInWeek(): number;
    get monthsInYear(): number;
    get inLeapYear(): boolean;
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
    this.offset * 60,
    undefined, // Neo4j doesn't recommend timezone names as they are ambiguous
  );
};

DateTime.prototype.toPostgres = function (this: DateTime) {
  return this.toSQL();
};

setInspectOnClass(DateTime, (dt) => ({ collapsed }) => {
  return collapsed(dt.toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS));
});

Object.defineProperties(DateTime.prototype, {
  dayOfWeek: {
    get(this: DateTime) {
      return this.weekday;
    },
  },
  dayOfYear: {
    get(this: DateTime) {
      return this.ordinal;
    },
  },
  daysInWeek: {
    get(this: DateTime) {
      return 7;
    },
  },
  monthsInYear: {
    get(this: DateTime) {
      return 12;
    },
  },
  inLeapYear: {
    get(this: DateTime) {
      return this.isInLeapYear;
    },
  },
});
