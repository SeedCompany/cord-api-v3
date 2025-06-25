import { DateTime } from 'luxon';
import { CalendarDate } from './calendar-date';
import { DateInterval } from './date-interval';

describe('Calendar Widget Bug - Interval Creation Edge Case', () => {
  it('tests potential issue in DateInterval creation process', () => {
    const nov1 = CalendarDate.local(2025, 11, 1);
    const nov30 = CalendarDate.local(2025, 11, 30); // Sunday
    
    console.log('=== Testing DateInterval Creation Process ===');
    console.log('Original dates:');
    console.log('- nov1:', nov1.toISO(), 'valueOf:', nov1.valueOf());
    console.log('- nov30:', nov30.toISO(), 'valueOf:', nov30.valueOf());
    
    // Step 1: See what happens when we create Luxon Interval
    const luxonInterval = DateTime.fromISO(nov1.toISO()).until(DateTime.fromISO(nov30.toISO()));
    console.log('\\nLuxon Interval (half-open):');
    console.log('- start:', luxonInterval.start?.toISO());
    console.log('- end:', luxonInterval.end?.toISO());
    
    // Step 2: See what DateInterval.fromDateTimes does
    const dateInterval = DateInterval.fromDateTimes(nov1, nov30);
    console.log('\\nDateInterval (closed):');
    console.log('- start:', dateInterval.start.toISO(), 'valueOf:', dateInterval.start.valueOf());
    console.log('- end:', dateInterval.end.toISO(), 'valueOf:', dateInterval.end.valueOf());
    
    // Step 3: Check if the dates are exactly the same after round-trip
    const startMatches = nov1.equals(dateInterval.start);
    const endMatches = nov30.equals(dateInterval.end);
    
    console.log('\\nRound-trip comparison:');
    console.log('- start matches:', startMatches);
    console.log('- end matches:', endMatches);
    console.log('- start valueOf equal:', nov1.valueOf() === dateInterval.start.valueOf());
    console.log('- end valueOf equal:', nov30.valueOf() === dateInterval.end.valueOf());
    
    expect(startMatches).toBe(true);
    expect(endMatches).toBe(true);
    
    // Step 4: Test the contains method with the exact same instance
    const containsSameInstance = dateInterval.contains(nov30);
    const containsCopy = dateInterval.contains(CalendarDate.fromISO('2025-11-30'));
    
    console.log('\\nContains tests:');
    console.log('- contains same instance:', containsSameInstance);
    console.log('- contains copy from ISO:', containsCopy);
    
    expect(containsSameInstance).toBe(true);
    expect(containsCopy).toBe(true);
  });

  it('tests if timezone affects CalendarDate equality', () => {
    // Create the same date in different ways to check for timezone issues
    const methods = [
      { name: 'local', create: () => CalendarDate.local(2025, 11, 30) },
      { name: 'utc', create: () => CalendarDate.utc(2025, 11, 30) },
      { name: 'fromISO', create: () => CalendarDate.fromISO('2025-11-30') },
      { name: 'fromDateTime local', create: () => CalendarDate.fromDateTime(DateTime.local(2025, 11, 30)) },
      { name: 'fromDateTime utc', create: () => CalendarDate.fromDateTime(DateTime.utc(2025, 11, 30)) },
    ];
    
    console.log('=== Testing CalendarDate Creation Methods ===');
    
    const dates = methods.map(({ name, create }) => {
      const date = create();
      console.log(`${name}:`, {
        toISO: date.toISO(),
        valueOf: date.valueOf(),
        weekday: date.weekday,
        offset: date.offset
      });
      return { name, date };
    });
    
    // All should be equal
    const baseDate = dates[0].date;
    dates.slice(1).forEach(({ name, date }) => {
      const areEqual = baseDate.equals(date);
      console.log(`${dates[0].name} equals ${name}:`, areEqual);
      expect(areEqual).toBe(true);
    });
  });

  it('tests CalendarDate comparison edge cases', () => {
    const nov30 = CalendarDate.local(2025, 11, 30);
    const dec1 = CalendarDate.local(2025, 12, 1);
    
    // Test the exact comparison used in DateInterval.contains()
    console.log('=== Testing Comparison Operators ===');
    console.log('nov30 < dec1:', nov30 < dec1);
    console.log('nov30 <= dec1:', nov30 <= dec1);
    console.log('nov30 >= nov30:', nov30 >= nov30);
    console.log('nov30 === nov30:', nov30 === nov30);
    console.log('nov30.equals(nov30):', nov30.equals(nov30));
    
    // Test with the exact logic from toSuper()
    const endPlusOne = nov30.plus({ days: 1 });
    console.log('\\nendPlusOne comparison:');
    console.log('endPlusOne:', endPlusOne.toISO());
    console.log('nov30 < endPlusOne:', nov30 < endPlusOne);
    console.log('endPlusOne equals dec1:', endPlusOne.equals(dec1));
    
    expect(nov30 < dec1).toBe(true);
    expect(nov30 < endPlusOne).toBe(true);
    expect(endPlusOne.equals(dec1)).toBe(true);
  });
});