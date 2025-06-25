import { DateTime } from 'luxon';
import { CalendarDate } from './calendar-date';
import { DateInterval } from './date-interval';

describe('Calendar Widget Bug Investigation', () => {
  it('should handle November 2025 ending on Sunday correctly', () => {
    // November 2025 - the specific case from the bug report
    const nov2025Start = CalendarDate.local(2025, 11, 1);
    const nov2025End = nov2025Start.endOf('month');
    
    // November 30, 2025 should be a Sunday
    expect(nov2025End.toISO()).toBe('2025-11-30');
    expect(nov2025End.weekday).toBe(7); // Sunday
    
    // Create an interval for the whole month
    const monthInterval = DateInterval.fromDateTimes(nov2025Start, nov2025End);
    
    // The interval should contain the last day of the month (Sunday)
    const lastDay = CalendarDate.local(2025, 11, 30);
    expect(monthInterval.contains(lastDay)).toBe(true);
    
    // Test that the interval properly represents the month
    expect(monthInterval.start.toISO()).toBe('2025-11-01');
    expect(monthInterval.end.toISO()).toBe('2025-11-30');
  });

  it('should handle month intervals ending on Sundays', () => {
    // Test several months that end on Sunday
    const testCases = [
      { year: 2025, month: 11, day: 30 }, // November 2025
      { year: 2024, month: 6, day: 30 },  // June 2024
      { year: 2023, month: 4, day: 30 },  // April 2023
    ];

    testCases.forEach(({ year, month, day }) => {
      const monthStart = CalendarDate.local(year, month, 1);
      const monthEnd = monthStart.endOf('month');
      const lastDay = CalendarDate.local(year, month, day);
      
      // Verify the last day is actually a Sunday
      if (lastDay.weekday === 7) {
        const interval = DateInterval.fromDateTimes(monthStart, monthEnd);
        
        expect(interval.contains(lastDay)).toBe(true);
        expect(interval.end.equals(lastDay)).toBe(true);
      }
    });
  });

  it('should handle week intervals ending on Sunday', () => {
    // Test a week that ends on Sunday (like Nov 24-30, 2025)
    const weekStart = CalendarDate.local(2025, 11, 24); // Monday
    const weekEnd = CalendarDate.local(2025, 11, 30);   // Sunday
    
    expect(weekEnd.weekday).toBe(7); // Confirm it's Sunday
    
    const weekInterval = DateInterval.fromDateTimes(weekStart, weekEnd);
    
    // The interval should contain all days including Sunday
    expect(weekInterval.contains(weekStart)).toBe(true);
    expect(weekInterval.contains(weekEnd)).toBe(true);
    
    // Check a few days in between
    expect(weekInterval.contains(CalendarDate.local(2025, 11, 27))).toBe(true); // Thursday
    expect(weekInterval.contains(CalendarDate.local(2025, 11, 29))).toBe(true); // Saturday
  });

  it('should properly convert between closed and open intervals', () => {
    // Test the conversion logic that might be causing issues
    const start = CalendarDate.local(2025, 11, 24);
    const end = CalendarDate.local(2025, 11, 30); // Sunday
    
    const dateInterval = DateInterval.fromDateTimes(start, end);
    
    // The DateInterval should be inclusive of both endpoints
    expect(dateInterval.contains(start)).toBe(true);
    expect(dateInterval.contains(end)).toBe(true);
    
    // Test edge case: the day after the end should not be contained
    const dayAfter = end.plus({ days: 1 });
    expect(dateInterval.contains(dayAfter)).toBe(false);
    
    // Test edge case: the day before the start should not be contained
    const dayBefore = start.minus({ days: 1 });
    expect(dateInterval.contains(dayBefore)).toBe(false);
  });
});