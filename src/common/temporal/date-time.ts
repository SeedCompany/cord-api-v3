import { setInspectOnClass, setToStringTag } from '@seedcompany/common';
import { markSkipClassTransformation } from '@seedcompany/nest';
import { DateTime, Settings } from 'luxon';

/* eslint-disable @typescript-eslint/method-signature-style */
declare module 'luxon' {
  interface DateTime {
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

Settings.throwOnInvalid = true;
declare module 'luxon' {
  interface TSSettings {
    throwOnInvalid: true;
  }
}

setInspectOnClass(DateTime, (dt) => ({ collapsed }) => {
  return collapsed(dt.toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS));
});
setToStringTag(DateTime, 'DateTime');
markSkipClassTransformation(DateTime);

Object.defineProperties(DateTime.prototype, {
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
