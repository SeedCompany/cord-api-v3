import { DateTime } from 'luxon';
import { CalendarDate } from './calendar-date';
import { DateInterval } from './date-interval';

describe('Calendar Date Issue Debug', () => {
  it('reproduces November 2025 issue step by step', () => {
    console.log('=== Testing November 2025 Calendar Issue ===');
    
    // Step 1: Create dates for November 2025
    const nov1 = CalendarDate.local(2025, 11, 1);
    const nov30 = CalendarDate.local(2025, 11, 30);
    
    console.log('Nov 1:', nov1.toISO(), '(weekday:', nov1.weekday, ')');
    console.log('Nov 30:', nov30.toISO(), '(weekday:', nov30.weekday, ')');
    
    // Step 2: Test endOf month
    const nov1EndOfMonth = nov1.endOf('month');
    console.log('nov1.endOf("month"):', nov1EndOfMonth.toISO(), '(weekday:', nov1EndOfMonth.weekday, ')');
    
    // Step 3: Create a DateInterval using fromDateTimes
    const interval = DateInterval.fromDateTimes(nov1, nov30);
    console.log('Interval:', interval.toString());
    
    // Step 4: Test if interval contains the last day
    const containsNov30 = interval.contains(nov30);
    console.log('Interval contains Nov 30:', containsNov30);
    
    // Step 5: Test the conversion to/from Luxon intervals
    // This is what happens internally in the contains method
    const luxonStart = interval.start;
    const luxonEnd = interval.end;
    console.log('Interval start:', luxonStart.toISO());
    console.log('Interval end:', luxonEnd.toISO());
    
    // Step 6: Test the actual contains logic manually
    const luxonInterval = DateTime.fromISO(luxonStart.toISO()).until(
      DateTime.fromISO(luxonEnd.toISO()).plus({ days: 1 })
    );
    const containsManual = luxonInterval.contains(DateTime.fromISO(nov30.toISO()));
    console.log('Manual contains check:', containsManual);
    
    expect(containsNov30).toBe(true);
  });

  it('tests the specific conversion issue', () => {
    // Test the toSuper/fromSuper conversion logic
    const start = CalendarDate.local(2025, 11, 1);
    const end = CalendarDate.local(2025, 11, 30); // Sunday
    
    const dateInterval = DateInterval.fromDateTimes(start, end);
    
    // Manually test the toSuper conversion
    const luxonInterval = DateTime.fromISO(start.toISO()).until(
      DateTime.fromISO(end.toISO()).plus({ days: 1 })
    );
    
    console.log('Original DateInterval:', dateInterval.toString());
    console.log('Luxon interval start:', luxonInterval.start?.toISO());
    console.log('Luxon interval end:', luxonInterval.end?.toISO());
    
    // Test if the Luxon interval contains the end date
    const containsEndInLuxon = luxonInterval.contains(DateTime.fromISO(end.toISO()));
    console.log('Luxon interval contains end date:', containsEndInLuxon);
    
    // Test if the DateInterval contains the end date
    const containsEndInDateInterval = dateInterval.contains(end);
    console.log('DateInterval contains end date:', containsEndInDateInterval);
    
    expect(containsEndInDateInterval).toBe(true);
  });
});