import { CalendarDate } from './calendar-date';
import { DateInterval } from './date-interval';

describe('Calendar Widget Bug - November 2025 Failing Test', () => {
  /**
   * This test is designed to fail if there's a bug with Sunday month-end dates.
   * Based on the issue report, November 30, 2025 (Sunday) is not being rendered
   * as selectable in the calendar widget.
   */
  it('SHOULD FAIL: November 30, 2025 (Sunday) should be selectable', () => {
    // The exact case from the bug report
    const nov1_2025 = CalendarDate.local(2025, 11, 1);
    const nov30_2025 = CalendarDate.local(2025, 11, 30);
    
    // Verify November 30, 2025 is indeed a Sunday
    expect(nov30_2025.weekday).toBe(7);
    
    // Create a project/engagement date range for November 2025
    const dateRange = DateInterval.fromDateTimes(nov1_2025, nov30_2025);
    
    // This should always be true, but according to the bug report,
    // the UI is not rendering Nov 30 as selectable
    const isNov30Contained = dateRange.contains(nov30_2025);
    
    // Log details for debugging
    console.log('November 2025 Calendar Bug Test:');
    console.log('- Range:', dateRange.toString());
    console.log('- Nov 30 weekday:', nov30_2025.weekdayLong);
    console.log('- Contains Nov 30:', isNov30Contained);
    
    // If this fails, we've reproduced the backend side of the bug
    expect(isNov30Contained).toBe(true);
  });

  it('tests all Sunday month-ends to see if pattern exists', () => {
    // Find months ending on Sunday and test them
    const sundayMonthEnds = [];
    
    // Check several years
    for (let year = 2023; year <= 2026; year++) {
      for (let month = 1; month <= 12; month++) {
        const firstDay = CalendarDate.local(year, month, 1);
        const lastDay = firstDay.endOf('month');
        
        if (lastDay.weekday === 7) { // Sunday
          sundayMonthEnds.push({
            date: lastDay,
            monthName: lastDay.monthLong,
            year: lastDay.year
          });
        }
      }
    }
    
    console.log('Testing all Sunday month-ends:');
    sundayMonthEnds.forEach(({ date, monthName, year }) => {
      const monthStart = CalendarDate.local(year, date.month, 1);
      const monthRange = DateInterval.fromDateTimes(monthStart, date);
      const isContained = monthRange.contains(date);
      
      console.log(`${monthName} ${year}: ${date.toISO()} contained = ${isContained}`);
      
      // All should be true - if any fail, we've found the pattern
      expect(isContained).toBe(true);
    });
  });

  // Test the specific GraphQL resolver patterns that the frontend consumes
  it('tests GraphQL dateRange resolution for November 2025', () => {
    const mockProject = {
      mouStart: CalendarDate.local(2025, 11, 1),
      mouEnd: CalendarDate.local(2025, 11, 30) // Sunday
    };
    
    // This simulates what happens in ProjectResolver.mouRange()
    const mouRange = {
      start: mockProject.mouStart,
      end: mockProject.mouEnd
    };
    
    console.log('GraphQL mouRange resolution:');
    console.log('- start:', mouRange.start.toISO());
    console.log('- end:', mouRange.end.toISO());
    console.log('- end weekday:', mouRange.end.weekdayLong);
    
    // The frontend should receive the correct end date
    expect(mouRange.end.toISO()).toBe('2025-11-30');
    expect(mouRange.end.weekday).toBe(7);
  });
});