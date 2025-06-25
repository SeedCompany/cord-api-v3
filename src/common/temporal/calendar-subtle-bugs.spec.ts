import { DateTime } from 'luxon';
import { CalendarDate } from './calendar-date';
import { DateInterval } from './date-interval';

/**
 * Test potential subtle bugs in CalendarDate comparison logic
 * that might only manifest with Sunday dates at month boundaries.
 */
describe('Calendar Widget Bug - Subtle Comparison Issues', () => {
  it('checks if CalendarDate comparison has timezone issues', () => {
    // Create the same date using different methods to see if they compare equally
    const methods = [
      { name: 'local', date: CalendarDate.local(2025, 11, 30) },
      { name: 'utc', date: CalendarDate.utc(2025, 11, 30) },
      { name: 'fromISO', date: CalendarDate.fromISO('2025-11-30') },
    ];
    
    console.log('Testing CalendarDate equality across creation methods:');
    methods.forEach(({ name, date }) => {
      console.log(`${name}:`, {
        toISO: date.toISO(),
        valueOf: date.valueOf(),
        offset: date.offset,
        zoneName: date.zoneName,
        weekday: date.weekday
      });
    });
    
    // All should be equal
    const baseDate = methods[0].date;
    methods.slice(1).forEach(({ name, date }) => {
      const areEqual = baseDate.equals(date);
      const comparison = baseDate < date ? 'less' : baseDate > date ? 'greater' : 'equal';
      
      console.log(`${methods[0].name} vs ${name}: equals=${areEqual}, comparison=${comparison}`);
      expect(areEqual).toBe(true);
    });
  });

  it('checks for precision issues in date arithmetic', () => {
    const nov30 = CalendarDate.local(2025, 11, 30);
    const dec1 = nov30.plus({ days: 1 });
    const backToNov30 = dec1.minus({ days: 1 });
    
    console.log('Testing date arithmetic precision:');
    console.log('nov30:', nov30.toISO(), 'valueOf:', nov30.valueOf());
    console.log('dec1:', dec1.toISO(), 'valueOf:', dec1.valueOf());
    console.log('backToNov30:', backToNov30.toISO(), 'valueOf:', backToNov30.valueOf());
    console.log('nov30.equals(backToNov30):', nov30.equals(backToNov30));
    
    expect(nov30.equals(backToNov30)).toBe(true);
  });

  it('checks millisecond precision in comparisons', () => {
    // Create dates with slightly different internal representations
    const nov30_A = CalendarDate.local(2025, 11, 30);
    const nov30_B = CalendarDate.fromDateTime(DateTime.local(2025, 11, 30, 0, 0, 0, 1)); // +1 millisecond
    
    console.log('Testing millisecond precision:');
    console.log('nov30_A valueOf:', nov30_A.valueOf());
    console.log('nov30_B valueOf:', nov30_B.valueOf());
    console.log('nov30_A.equals(nov30_B):', nov30_A.equals(nov30_B));
    console.log('nov30_A < nov30_B:', nov30_A < nov30_B);
    console.log('nov30_A > nov30_B:', nov30_A > nov30_B);
    
    // They should be equal since CalendarDate ignores time components
    expect(nov30_A.equals(nov30_B)).toBe(true);
  });

  it('tests the exact inequality used in DateInterval.contains()', () => {
    // This replicates the exact logic from toSuper() and contains()
    const interval = DateInterval.fromDateTimes(
      CalendarDate.local(2025, 11, 1),
      CalendarDate.local(2025, 11, 30)
    );
    
    const testDate = CalendarDate.local(2025, 11, 30);
    const endPlusOne = interval.end.plus({ days: 1 });
    
    console.log('Testing exact inequality logic:');
    console.log('testDate:', testDate.toISO(), 'valueOf:', testDate.valueOf());
    console.log('interval.start:', interval.start.toISO(), 'valueOf:', interval.start.valueOf());
    console.log('interval.end:', interval.end.toISO(), 'valueOf:', interval.end.valueOf());
    console.log('endPlusOne:', endPlusOne.toISO(), 'valueOf:', endPlusOne.valueOf());
    
    const checks = {
      'testDate >= interval.start': testDate >= interval.start,
      'testDate < endPlusOne': testDate < endPlusOne,
      'testDate.valueOf() >= interval.start.valueOf()': testDate.valueOf() >= interval.start.valueOf(),
      'testDate.valueOf() < endPlusOne.valueOf()': testDate.valueOf() < endPlusOne.valueOf(),
    };
    
    Object.entries(checks).forEach(([description, result]) => {
      console.log(`${description}:`, result);
    });
    
    // All should be true
    Object.values(checks).forEach(result => {
      expect(result).toBe(true);
    });
  });

  it('checks if there are floating point precision issues', () => {
    // Test if there might be floating point precision issues in date calculations
    const nov30 = CalendarDate.local(2025, 11, 30);
    const msValue = nov30.valueOf();
    
    console.log('Testing floating point precision:');
    console.log('nov30 ms value:', msValue);
    console.log('Is integer:', Number.isInteger(msValue));
    console.log('Precision:', msValue.toString().length);
    
    // Create a date from the millisecond value
    const fromMs = CalendarDate.fromMillis(msValue);
    console.log('Round-trip via milliseconds equals:', nov30.equals(fromMs));
    
    expect(nov30.equals(fromMs)).toBe(true);
  });

  /**
   * Test potential edge case: what if the issue is specific to the last day
   * of November when it falls on a Sunday? Maybe there's a leap second issue
   * or some other calendar-specific edge case.
   */
  it('tests November-specific edge cases', () => {
    // Test November 30 across multiple years when it's a Sunday
    const novemberSundays = [
      2025, // November 30, 2025 (the specific case from the bug)
      // Add other years where Nov 30 falls on Sunday
    ].map(year => CalendarDate.local(year, 11, 30))
     .filter(date => date.weekday === 7);
    
    console.log('Testing November 30 Sundays across years:');
    novemberSundays.forEach(date => {
      const monthStart = CalendarDate.local(date.year, date.month, 1);
      const interval = DateInterval.fromDateTimes(monthStart, date);
      const contains = interval.contains(date);
      
      console.log(`${date.year}: ${date.toISO()} (${date.weekdayLong}) contained:`, contains);
      expect(contains).toBe(true);
    });
  });
});