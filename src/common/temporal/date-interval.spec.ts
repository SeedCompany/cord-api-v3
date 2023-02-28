import { differenceWith } from 'lodash';
import { DateTime, Interval } from 'luxon';
import { CalendarDate } from './calendar-date';
import { DateInterval } from './date-interval';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- it's fine for module augmentation
  namespace jest {
    // eslint-disable-next-line @seedcompany/no-unused-vars,@typescript-eslint/ban-types
    interface Matchers<R, T = {}> {
      toBeDateInterval: (expected: DateInterval) => R;
      toBeDateIntervals: (expected: DateInterval[]) => R;
    }
  }
}

expect.extend({
  toBeDateInterval(received: DateInterval, expected: DateInterval) {
    const pass = received.equals(expected);
    const message = () =>
      `${this.utils.matcherHint('toBeDateInterval', undefined, undefined, {
        isNot: this.isNot,
        promise: this.promise,
      })}\n\nExpected:${this.isNot ? ' not' : ''} ${this.utils.EXPECTED_COLOR(
        expected.toString(),
      )}\nReceived:${this.isNot ? '    ' : ''} ${this.utils.RECEIVED_COLOR(
        received.toString(),
      )}`;
    return { pass, message };
  },
  toBeDateIntervals(received: DateInterval[], expected: DateInterval[]) {
    const diEqual = (a: DateInterval, b: DateInterval) => a.equals(b);
    const pass =
      received.length === expected.length &&
      differenceWith(received, expected, diEqual).length === 0 &&
      differenceWith(expected, received, diEqual).length === 0;
    const matcherName = 'toBeDateIntervals';
    const expectedStrs = expected.map((e) => e.toString());
    const receivedStrs = received.map((e) => e.toString());
    const message = () =>
      `${this.utils.matcherHint(matcherName, undefined, undefined, {
        isNot: this.isNot,
        promise: this.promise,
      })}\n\n${this.utils
        .printDiffOrStringify(
          expectedStrs,
          receivedStrs,
          'Expected',
          'Received',
          this.expand ?? true,
        )
        .replace(/"/g, '')}`;
    return {
      pass,
      message,
      actual: receivedStrs,
      expected: expectedStrs,
      name: matcherName,
    };
  },
});

const expectInstances = (int: DateInterval) => {
  expect(int).toBeInstanceOf(DateInterval);
  expect(int.start).toBeInstanceOf(CalendarDate);
  expect(int.end).toBeInstanceOf(CalendarDate);
};

const day = (day: number) => CalendarDate.local(2020, 5, day);
const days = (start: number, end: number) => day(start).until(day(end));

describe('DateInterval', () => {
  it('fromISO -> toISO', () => {
    const iso = '2020-03-04/2021-05-22';
    const interval = DateInterval.fromISO(iso);
    expectInstances(interval);
    expect(interval.toISO()).toBe(iso);
    expect(interval.toISODate()).toBe(iso);
    expect(() => interval.toISOTime()).toThrowError();
  });
  it('toString', () => {
    const interval = DateInterval.fromISO('2020-03-04/2021-05-22');
    expect(interval.toString()).toBe('[2020-03-04 – 2021-05-22]');
  });
  it('length', () => {
    const interval = DateInterval.fromISO('2020-03-04/2021-05-22');
    expect(interval.length()).toBe(445);
    expect(interval.length('years')).toBeCloseTo(1.216);
    expect(interval.length('months')).toBeCloseTo(14.612);
  });
  it('toDuration', () => {
    const interval = DateInterval.fromISO('2020-03-04/2021-05-22');
    expect(interval.toDuration().toObject()).toEqual({ days: 445 });
    expect(interval.toDuration(['years', 'months', 'days']).toObject()).toEqual(
      { years: 1, months: 2, days: 19 },
    );
  });
  it('fromInterval', () => {
    const dtInterval = Interval.fromISO('2020-03-04T04/2021-05-22T05');
    const interval = DateInterval.fromInterval(dtInterval);
    expectInstances(interval);
    expect(interval.toISO()).toBe('2020-03-04/2021-05-22');
  });
  it('after', () => {
    const start = DateTime.fromISO('2020-03-01');
    const interval = DateInterval.after(start, { days: 14 });
    expectInstances(interval);
    expect(interval.end.toISO()).toBe('2020-03-14');
  });
  it('before', () => {
    const end = DateTime.fromISO('2020-03-14');
    const interval = DateInterval.before(end, { days: 14 });
    expectInstances(interval);
    expect(interval.start.toISO()).toBe('2020-03-01');
  });
  it('fromDateTimes', () => {
    const start = DateTime.local(2020, 4, 2, 13, 3, 1);
    const end = DateTime.local(2020, 4, 23, 10);
    const interval = DateInterval.fromDateTimes(start, end);
    expectInstances(interval);
    expect(interval.toISO()).toBe('2020-04-02/2020-04-23');
  });
  it('count', () => {
    expect(days(5, 8).count()).toBe(4);
    expect(days(5, 5).count('days')).toBe(1);
    expect(days(5, 5).count('months')).toBe(1);
    expect(days(5, 5).count('years')).toBe(1);

    const quarter = DateInterval.fromDateTimes(
      DateTime.local(2020, 1, 1),
      DateTime.local(2020, 3, 31),
    );
    expect(quarter.count('quarters')).toBe(1);
    expect(quarter.count('years')).toBe(1);

    const fourQuarters = DateInterval.fromDateTimes(
      DateTime.local(2020, 1, 1),
      DateTime.local(2020, 12, 31),
    );
    expect(fourQuarters.count('years')).toBe(1);
    expect(fourQuarters.count('quarters')).toBe(4);

    const yearAndDay = DateInterval.fromDateTimes(
      DateTime.local(2019, 1, 1),
      DateTime.local(2020, 1, 1),
    );

    expect(yearAndDay.count('years')).toBe(2);
    expect(yearAndDay.count('months')).toBe(13);
    expect(yearAndDay.count('quarters')).toBe(5);
  });
  it('contains', () => {
    expect(days(5, 8).contains(day(6))).toBeTruthy();
    expect(days(5, 8).contains(day(5))).toBeTruthy();
    expect(days(5, 8).contains(day(8))).toBeTruthy();
    expect(days(5, 8).contains(day(9))).toBeFalsy();
    expect(days(5, 8).contains(day(4))).toBeFalsy();
  });
  it('isBefore', () => {
    expect(days(5, 8).isBefore(day(9))).toBeTruthy();
    expect(days(5, 8).isBefore(day(6))).toBeFalsy();
    expect(days(5, 8).isBefore(day(3))).toBeFalsy();
    expect(days(5, 8).isBefore(day(8))).toBeFalsy();
  });
  it('isAfter', () => {
    expect(days(5, 8).isAfter(day(4))).toBeTruthy();
    expect(days(5, 8).isAfter(day(5))).toBeFalsy();
    expect(days(5, 8).isAfter(day(10))).toBeFalsy();
    expect(days(5, 8).isAfter(day(8))).toBeFalsy();
  });
  it('union', () => {
    expect(days(5, 8).union(days(10, 11))).toBeDateInterval(days(5, 11));
    expect(days(5, 8).union(days(2, 4))).toBeDateInterval(days(2, 8));
    expect(days(5, 8).union(days(7, 10))).toBeDateInterval(days(5, 10));
    expect(days(5, 8).union(days(4, 6))).toBeDateInterval(days(4, 8));
    expect(days(5, 8).union(days(6, 7))).toBeDateInterval(days(5, 8));
    expect(days(5, 8).union(days(4, 10))).toBeDateInterval(days(4, 10));
    expect(days(5, 8).union(days(9, 10))).toBeDateInterval(days(5, 10));
  });
  describe('intersection', () => {
    it('no intersection is null', () => {
      expect(days(5, 8).intersection(days(2, 3))).toBeNull();
    });
    it('partial overlap', () => {
      expect(days(5, 8).intersection(days(3, 7))).toBeDateInterval(days(5, 7));
      expect(days(5, 8).intersection(days(7, 10))).toBeDateInterval(days(7, 8));
    });
    it('overlap', () => {
      expect(days(5, 8).intersection(days(3, 10))).toBeDateInterval(days(5, 8));
      expect(days(3, 10).intersection(days(5, 8))).toBeDateInterval(days(5, 8));
    });
    it('null for adjacent', () => {
      expect(days(5, 8).intersection(days(9, 10))).toBeNull();
      expect(days(5, 8).intersection(days(2, 4))).toBeNull();
    });
  });
  it('merge', () => {
    const merged = DateInterval.merge([
      days(5, 19),
      days(1, 4),
      days(20, 22),
      days(24, 27),
      days(26, 29),
    ]);
    expect(merged).toBeDateIntervals([days(1, 22), days(24, 29)]);
  });
  describe('xor', () => {
    it('non-overlapping', () => {
      const nonOverlapping = [days(5, 6), days(8, 9)];
      expect(DateInterval.xor(nonOverlapping)).toBeDateIntervals(
        nonOverlapping,
      );
    });

    it('empty for fully overlapping', () => {
      expect(DateInterval.xor([days(5, 8), days(5, 8)])).toBeDateIntervals([]);
      expect(
        DateInterval.xor([days(5, 8), days(5, 6), days(6, 8)]),
      ).toBeDateIntervals([]);
    });

    it('non-overlapping parts', () => {
      // overlapping
      expect(DateInterval.xor([days(5, 8), days(7, 11)])).toBeDateIntervals([
        days(5, 6),
        days(9, 11),
      ]);

      // engulfing
      expect(DateInterval.xor([days(5, 12), days(9, 10)])).toBeDateIntervals([
        days(5, 8),
        days(11, 12),
      ]);

      // adjacent
      expect(DateInterval.xor([days(5, 6), days(7, 8)])).toBeDateIntervals([
        days(5, 8),
      ]);

      // three intervals
      expect(
        DateInterval.xor([days(10, 13), days(8, 10), days(12, 14)]),
      ).toBeDateIntervals([days(8, 9), days(11, 11), days(14, 14)]);
    });
  });
  describe('difference', () => {
    it('non-overlapping', () => {
      expect(days(7, 8).difference(days(10, 11))).toBeDateIntervals([
        days(7, 8),
      ]);
      expect(days(7, 8).difference(days(5, 6))).toBeDateIntervals([days(7, 8)]);
    });
    it('non-overlapping parts', () => {
      expect(days(8, 10).difference(days(10, 11))).toBeDateIntervals([
        days(8, 9),
      ]);
      expect(days(9, 11).difference(days(8, 9))).toBeDateIntervals([
        days(10, 11),
      ]);
      expect(
        days(8, 11).difference(days(7, 8), days(11, 12)),
      ).toBeDateIntervals([days(9, 10)]);
      expect(
        days(9, 11).difference(days(8, 9), days(11, 11)),
      ).toBeDateIntervals([days(10, 10)]);
    });
    it('empty for fully subtracted', () => {
      expect(days(8, 10).difference(days(7, 11))).toBeDateIntervals([]);
      expect(
        days(8, 11).difference(days(8, 9), days(10, 11)),
      ).toBeDateIntervals([]);
      expect(
        days(6, 12).difference(days(6, 9), days(8, 11), days(10, 13)),
      ).toBeDateIntervals([]);
    });
    it('returns outside parts when engulfing another interval', () => {
      expect(days(8, 13).difference(days(10, 11))).toBeDateIntervals([
        days(8, 9),
        days(12, 13),
      ]);
      expect(
        days(8, 14).difference(days(10, 11), days(11, 12)),
      ).toBeDateIntervals([days(8, 9), days(13, 14)]);
    });
    it('allows holes', () => {
      expect(
        days(8, 14).difference(days(10, 10), days(12, 12)),
      ).toBeDateIntervals([days(8, 9), days(11, 11), days(13, 14)]);
    });
  });
  it('overlaps', () => {
    expect(days(5, 8).overlaps(days(4, 4))).toBeFalsy();
    expect(days(5, 8).overlaps(days(4, 5))).toBeTruthy();
    expect(days(5, 8).overlaps(days(5, 6))).toBeTruthy();
    expect(days(5, 8).overlaps(days(8, 9))).toBeTruthy();
    expect(days(5, 8).overlaps(days(9, 10))).toBeFalsy();
  });
  it('engulfs', () => {
    const int = days(9, 12);
    expect(int.engulfs(days(13, 15))).toBeFalsy(); // wholly later
    expect(int.engulfs(days(11, 15))).toBeFalsy(); // partially later
    expect(int.engulfs(days(6, 8))).toBeFalsy(); // wholly earlier
    expect(int.engulfs(days(6, 10))).toBeFalsy(); // partially earlier
    expect(int.engulfs(days(8, 13))).toBeFalsy(); // engulfed
    expect(int.engulfs(days(10, 11))).toBeTruthy(); // engulfing
    expect(int.engulfs(days(9, 12))).toBeTruthy(); // equal
  });
  it('abutsStart', () => {
    expect(days(9, 10).abutsStart(days(11, 12))).toBeTruthy();
    expect(days(9, 10).abutsStart(days(12, 13))).toBeFalsy();
    expect(days(9, 10).abutsStart(days(8, 11))).toBeFalsy();
    expect(days(9, 10).abutsStart(days(9, 10))).toBeFalsy();
  });
  it('abutsEnd', () => {
    expect(days(9, 11).abutsEnd(days(7, 8))).toBeTruthy();
    expect(days(9, 11).abutsEnd(days(7, 9))).toBeFalsy();
    expect(days(9, 11).abutsEnd(days(7, 7))).toBeFalsy();
    expect(days(9, 11).abutsEnd(days(9, 11))).toBeFalsy();
  });
  describe('splitAt', () => {
    it('breaks up the interval', () => {
      const split = days(5, 13).splitAt(day(7), day(10));
      expect(split).toBeDateIntervals([days(5, 6), days(7, 9), days(10, 13)]);
    });
    it('ignores dates outside the interval', () => {
      const allBefore = days(8, 13).splitAt(day(7));
      expect(allBefore).toBeDateIntervals([days(8, 13)]);

      const allAfter = days(8, 13).splitAt(day(14));
      expect(allAfter).toBeDateIntervals([days(8, 13)]);

      const oneBeforeOneDuring = days(8, 13).splitAt(day(7), day(10));
      expect(oneBeforeOneDuring).toBeDateIntervals([days(8, 9), days(10, 13)]);

      const oneAfterOneDuring = days(8, 13).splitAt(day(10), day(15));
      expect(oneAfterOneDuring).toBeDateIntervals([days(8, 9), days(10, 13)]);
    });
  });
  it('splitBy', () => {
    expect(days(5, 13).splitBy({ days: 2 })).toBeDateIntervals([
      days(5, 6),
      days(7, 8),
      days(9, 10),
      days(11, 12),
      days(13, 13),
    ]);
  });
});
