import { CalendarDate } from './calendar-date';
import { DateInterval } from './date-interval';

describe('Calendar Widget Bug - November 2025', () => {
  // This test should reproduce the exact issue from the bug report
  it('November 30, 2025 (Sunday) should be contained in November date range', () => {
    // Create November 2025 range (whole month)
    const startOfMonth = CalendarDate.local(2025, 11, 1);
    const endOfMonth = CalendarDate.local(2025, 11, 30);
    
    // Verify November 30, 2025 is indeed a Sunday
    expect(endOfMonth.weekday).toBe(7);
    
    // Create date interval for the month
    const monthRange = DateInterval.fromDateTimes(startOfMonth, endOfMonth);
    
    // The bug: November 30 (Sunday) should be contained but might not be
    const lastDayOfMonth = CalendarDate.local(2025, 11, 30);
    const isContained = monthRange.contains(lastDayOfMonth);
    
    // This should pass, but if there's a bug, it might fail
    expect(isContained).toBe(true);
  });

  // Test several months ending on Sunday to see if it's a pattern
  it('should handle all month-ends that fall on Sunday', () => {
    const sundayMonthEnds = [
      { year: 2025, month: 11, day: 30, name: 'November 2025' },
      { year: 2024, month: 6, day: 30, name: 'June 2024' },
      { year: 2023, month: 4, day: 30, name: 'April 2023' },
      { year: 2023, month: 7, day: 30, name: 'July 2023' },
    ];
    
    sundayMonthEnds.forEach(({ year, month, day, name }) => {
      const date = CalendarDate.local(year, month, day);
      
      // Only test if it's actually a Sunday
      if (date.weekday === 7) {
        const startOfMonth = CalendarDate.local(year, month, 1);
        const monthRange = DateInterval.fromDateTimes(startOfMonth, date);
        
        const isContained = monthRange.contains(date);
        
        // Should always be true
        expect(isContained).toBe(true, `${name} (Sunday) should be contained in its month range`);
      }
    });
  });

  // Test if the issue is specific to project/engagement date ranges
  it('should work correctly with projectRange function pattern', () => {
    // Simulate what happens in projectRange()
    const mouStart = CalendarDate.local(2025, 11, 1);
    const mouEnd = CalendarDate.local(2025, 11, 30); // Sunday
    
    // This is exactly what projectRange() does
    const range = DateInterval.tryFrom(mouStart, mouEnd);
    
    expect(range).not.toBeNull();
    expect(range!.contains(mouEnd)).toBe(true);
  });

  // Test if there's an issue with week boundaries
  it('should handle week containing month-end Sunday correctly', () => {
    // November 24-30, 2025 (Monday to Sunday)
    const weekStart = CalendarDate.local(2025, 11, 24); // Monday
    const weekEnd = CalendarDate.local(2025, 11, 30);   // Sunday (last day of month)
    
    const weekRange = DateInterval.fromDateTimes(weekStart, weekEnd);
    
    // All days in the week should be contained
    for (let day = 24; day <= 30; day++) {
      const testDate = CalendarDate.local(2025, 11, day);
      const isContained = weekRange.contains(testDate);
      
      expect(isContained).toBe(true, `November ${day} should be contained in week range`);
    }
  });

  // Test conversion between CalendarDate and regular DateTime
  it('should handle DateTime to CalendarDate conversion correctly for Sundays', () => {
    // Test if there's an issue with DateTime -> CalendarDate conversion for Sundays
    const regularDateTime = new Date(2025, 10, 30); // Note: JavaScript months are 0-based
    const fromJSDate = CalendarDate.fromJSDate(regularDateTime);
    const direct = CalendarDate.local(2025, 11, 30);
    
    expect(fromJSDate.equals(direct)).toBe(true);
    expect(fromJSDate.weekday).toBe(7); // Sunday
    expect(direct.weekday).toBe(7); // Sunday
  });
});