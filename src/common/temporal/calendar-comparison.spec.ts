import { CalendarDate } from './calendar-date';
import { DateInterval } from './date-interval';

describe('CalendarDate Comparison Bug Investigation', () => {
  it('tests CalendarDate comparison operators', () => {
    const nov30 = CalendarDate.local(2025, 11, 30); // Sunday
    const dec1 = CalendarDate.local(2025, 12, 1);    // Monday
    const nov29 = CalendarDate.local(2025, 11, 29);  // Saturday
    
    console.log('Testing CalendarDate comparisons:');
    console.log('nov30:', nov30.toISO(), 'weekday:', nov30.weekday);
    console.log('dec1:', dec1.toISO(), 'weekday:', dec1.weekday);
    console.log('nov29:', nov29.toISO(), 'weekday:', nov29.weekday);
    
    console.log('nov30 < dec1:', nov30 < dec1);
    console.log('nov30 >= nov29:', nov30 >= nov29);
    console.log('nov30.equals(nov30):', nov30.equals(nov30));
    
    // Test the specific logic used in DateInterval.contains()
    // This simulates what toSuper() does
    const rangeStart = CalendarDate.local(2025, 11, 1);
    const rangeEnd = CalendarDate.local(2025, 11, 30);
    const convertedEnd = rangeEnd.plus({ days: 1 }); // Should be Dec 1
    
    console.log('Range conversion test:');
    console.log('rangeStart:', rangeStart.toISO());
    console.log('rangeEnd:', rangeEnd.toISO());
    console.log('convertedEnd (rangeEnd + 1):', convertedEnd.toISO());
    
    // Test if nov30 is in [rangeStart, convertedEnd)
    const isInRange = nov30 >= rangeStart && nov30 < convertedEnd;
    console.log('nov30 >= rangeStart:', nov30 >= rangeStart);
    console.log('nov30 < convertedEnd:', nov30 < convertedEnd);
    console.log('Combined (should be true):', isInRange);
    
    expect(isInRange).toBe(true);
  });

  it('tests CalendarDate.plus() method specifically', () => {
    const nov30 = CalendarDate.local(2025, 11, 30); // Sunday, last day of month
    const plusOne = nov30.plus({ days: 1 });
    
    console.log('Testing CalendarDate.plus():');
    console.log('nov30:', nov30.toISO(), 'weekday:', nov30.weekday);
    console.log('nov30.plus({days: 1}):', plusOne.toISO(), 'weekday:', plusOne.weekday);
    
    // Should be December 1st
    expect(plusOne.year).toBe(2025);
    expect(plusOne.month).toBe(12);
    expect(plusOne.day).toBe(1);
    expect(plusOne.weekday).toBe(1); // Monday
  });

  it('tests the exact DateInterval.contains() implementation', () => {
    // Replicate the exact implementation of DateInterval.contains()
    const interval = DateInterval.fromDateTimes(
      CalendarDate.local(2025, 11, 1),
      CalendarDate.local(2025, 11, 30)
    );
    
    const testDate = CalendarDate.local(2025, 11, 30); // The problematic Sunday
    
    // This is the actual implementation from DateInterval.contains()
    const toSuper = (int: DateInterval) => {
      const luxonStart = int.start;
      const luxonEnd = int.end.plus({ days: 1 });
      
      console.log('toSuper conversion:');
      console.log('- Original interval:', int.toString());
      console.log('- Luxon start:', luxonStart.toISO());
      console.log('- Luxon end:', luxonEnd.toISO());
      
      // Create Luxon Interval
      return {
        contains: (date: CalendarDate) => {
          const result = date >= luxonStart && date < luxonEnd;
          console.log(`- Contains ${date.toISO()}:`, result);
          return result;
        }
      };
    };
    
    const luxonInterval = toSuper(interval);
    const result = luxonInterval.contains(testDate);
    
    console.log('Final result:', result);
    expect(result).toBe(true);
  });

  it('tests timezone-related issues', () => {
    // Check if there are any timezone conversion issues
    const nov30Local = CalendarDate.local(2025, 11, 30);
    const nov30UTC = CalendarDate.utc(2025, 11, 30);
    
    console.log('Timezone test:');
    console.log('nov30Local:', nov30Local.toISO(), 'offset:', nov30Local.offset);
    console.log('nov30UTC:', nov30UTC.toISO(), 'offset:', nov30UTC.offset);
    console.log('Are they equal?', nov30Local.equals(nov30UTC));
    
    // CalendarDate should ignore timezone differences
    expect(nov30Local.toISO()).toBe(nov30UTC.toISO());
  });
});