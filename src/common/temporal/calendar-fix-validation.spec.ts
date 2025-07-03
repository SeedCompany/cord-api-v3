import { CalendarDate } from './calendar-date';
import { DateInterval } from './date-interval';

describe('Calendar Widget Bug Fix - Sunday Month-End Validation', () => {
  it('fixes November 30, 2025 (Sunday) calendar selection issue', () => {
    // The exact case from the bug report
    const nov1_2025 = CalendarDate.local(2025, 11, 1);
    const nov30_2025 = CalendarDate.local(2025, 11, 30);
    
    // Verify November 30, 2025 is indeed a Sunday and last day of month
    expect(nov30_2025.weekday).toBe(7);
    expect(nov30_2025.equals(nov30_2025.endOf('month'))).toBe(true);
    
    // Create a project/engagement date range for November 2025
    const dateRange = DateInterval.fromDateTimes(nov1_2025, nov30_2025);
    
    // This should now always be true with the fix
    const isNov30Contained = dateRange.contains(nov30_2025);
    
    console.log('November 2025 Calendar Bug Fix Test:');
    console.log('- Range:', dateRange.toString());
    console.log('- Nov 30 weekday:', nov30_2025.weekdayLong);
    console.log('- Nov 30 is last day of month:', nov30_2025.equals(nov30_2025.endOf('month')));
    console.log('- Contains Nov 30:', isNov30Contained);
    
    expect(isNov30Contained).toBe(true);
  });

  it('validates the fix works for all Sunday month-ends', () => {
    // Test several months ending on Sunday
    const sundayMonthEnds = [
      { year: 2025, month: 11, day: 30, name: 'November 2025' },
      { year: 2024, month: 6, day: 30, name: 'June 2024' },
      { year: 2023, month: 4, day: 30, name: 'April 2023' },
      { year: 2023, month: 7, day: 30, name: 'July 2023' },
    ];
    
    console.log('Testing fix for all Sunday month-ends:');
    
    sundayMonthEnds.forEach(({ year, month, day, name }) => {
      const date = CalendarDate.local(year, month, day);
      
      // Only test if it's actually a Sunday and last day of month
      if (date.weekday === 7 && date.equals(date.endOf('month'))) {
        const monthStart = CalendarDate.local(year, month, 1);
        const monthRange = DateInterval.fromDateTimes(monthStart, date);
        const isContained = monthRange.contains(date);
        
        console.log(`${name}: ${date.toISO()} (Sunday) contained = ${isContained}`);
        expect(isContained).toBe(true);
      }
    });
  });

  it('validates the fix works with projectRange pattern', () => {
    // Test the exact pattern used in projectRange() function
    const mouStart = CalendarDate.local(2025, 11, 1);
    const mouEnd = CalendarDate.local(2025, 11, 30); // Sunday month-end
    
    // This is exactly what projectRange() does
    const range = DateInterval.tryFrom(mouStart, mouEnd);
    
    expect(range).not.toBeNull();
    expect(range!.contains(mouEnd)).toBe(true);
    
    console.log('ProjectRange pattern test:');
    console.log('- mouStart:', mouStart.toISO());
    console.log('- mouEnd:', mouEnd.toISO(), '(Sunday, month-end)');
    console.log('- Range contains mouEnd:', range!.contains(mouEnd));
  });

  it('validates the fix works with engagementRange pattern', () => {
    // Test the exact pattern used in engagementRange() function
    const startDate = CalendarDate.local(2025, 11, 1);
    const endDate = CalendarDate.local(2025, 11, 30); // Sunday month-end
    
    // This is exactly what engagementRange() does
    const range = DateInterval.tryFrom(startDate, endDate);
    
    expect(range).not.toBeNull();
    expect(range!.contains(endDate)).toBe(true);
    
    console.log('EngagementRange pattern test:');
    console.log('- startDate:', startDate.toISO());
    console.log('- endDate:', endDate.toISO(), '(Sunday, month-end)');
    console.log('- Range contains endDate:', range!.contains(endDate));
  });

  it('ensures fix does not break existing functionality', () => {
    // Test that the fix doesn't break existing date interval functionality
    const testCases = [
      { start: CalendarDate.local(2020, 5, 5), end: CalendarDate.local(2020, 5, 8) },
      { start: CalendarDate.local(2020, 1, 1), end: CalendarDate.local(2020, 12, 31) },
      { start: CalendarDate.local(2025, 2, 1), end: CalendarDate.local(2025, 2, 28) },
    ];
    
    testCases.forEach(({ start, end }) => {
      const interval = DateInterval.fromDateTimes(start, end);
      
      // Should contain both start and end dates
      expect(interval.contains(start)).toBe(true);
      expect(interval.contains(end)).toBe(true);
      
      // Should not contain dates outside the range
      const dayBefore = start.minus({ days: 1 });
      const dayAfter = end.plus({ days: 1 });
      expect(interval.contains(dayBefore)).toBe(false);
      expect(interval.contains(dayAfter)).toBe(false);
    });
  });

  it('tests edge case: December 31 when it falls on Sunday', () => {
    // Test the year boundary case
    const dec31_years = [2023, 2028, 2034]; // Years where Dec 31 falls on Sunday
    
    dec31_years.forEach(year => {
      const dec31 = CalendarDate.local(year, 12, 31);
      
      if (dec31.weekday === 7) { // Only test if it's actually Sunday
        const dec1 = CalendarDate.local(year, 12, 1);
        const decemberRange = DateInterval.fromDateTimes(dec1, dec31);
        
        const containsDec31 = decemberRange.contains(dec31);
        console.log(`December 31, ${year} (Sunday): contained = ${containsDec31}`);
        
        expect(containsDec31).toBe(true);
      }
    });
  });
});