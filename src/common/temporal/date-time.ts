import { setInspectOnClass, setToStringTag } from '@seedcompany/common';
import { markSkipClassTransformation } from '@seedcompany/nest';
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

setInspectOnClass(DateTime, (dt) => ({ collapsed }) => {
  return collapsed(dt.toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS));
});
setToStringTag(DateTime, 'DateTime');
markSkipClassTransformation(DateTime);

Object.defineProperties(DateTime.prototype, {
  toNeo4JDate: {
    value: function toNeo4JDate(this: DateTime) {
      return new Neo.types.Date(this.year, this.month, this.day);
    },
  },
  toNeo4JDateTime: {
    value: function toNeo4JDateTime(this: DateTime) {
      return new Neo.types.DateTime(
        this.year,
        this.month,
        this.day,
        this.hour,
        this.minute,
        this.second,
        this.millisecond * 1e6,
        this.offset * 60,
        undefined, // Neo4j doesn't recommend timezone names as they're ambiguous
      );
    },
  },
  toPostgres: {
    value: function toPostgres(this: DateTime) {
      return this.toSQL();
    },
  },
  // These below are for compatibility with Gel's LocalDate
  // which is a subset of Temporal.PlainDate
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
