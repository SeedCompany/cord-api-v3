import { CalendarDate } from './calendar-date';
import { DateInterval } from './date-interval';

/**
 * This test attempts to reproduce the exact issue described in the bug report:
 * "When the last day of a month falls on a Sunday, the UI does not render it as a selection."
 * 
 * The issue shows a calendar for November 2025 where November 30 (Sunday) is not selectable.
 */
describe('Calendar Widget Bug - Exact Reproduction', () => {
  it('reproduces November 2025 calendar selection issue', () => {
    // November 30, 2025 is a Sunday and the last day of the month
    const nov30_2025 = CalendarDate.local(2025, 11, 30);
    
    // Verify it's actually a Sunday
    expect(nov30_2025.weekday).toBe(7);
    
    // Test scenarios that the calendar widget might use:
    
    // Scenario 1: Month range for November 2025
    const monthStart = CalendarDate.local(2025, 11, 1);
    const monthEnd = monthStart.endOf('month');
    const monthRange = DateInterval.fromDateTimes(monthStart, monthEnd);
    
    console.log('Month range test:');
    console.log('- Month start:', monthStart.toISO());
    console.log('- Month end (calculated):', monthEnd.toISO());
    console.log('- Month end equals Nov 30:', monthEnd.equals(nov30_2025));
    console.log('- Month range contains Nov 30:', monthRange.contains(nov30_2025));
    
    expect(monthEnd.equals(nov30_2025)).toBe(true);
    expect(monthRange.contains(nov30_2025)).toBe(true);
    
    // Scenario 2: Project date range ending on Nov 30
    const projectRange = DateInterval.fromDateTimes(monthStart, nov30_2025);
    console.log('- Project range contains Nov 30:', projectRange.contains(nov30_2025));
    expect(projectRange.contains(nov30_2025)).toBe(true);
    
    // Scenario 3: Engagement date range ending on Nov 30
    const engagementRange = DateInterval.fromDateTimes(monthStart, nov30_2025);
    console.log('- Engagement range contains Nov 30:', engagementRange.contains(nov30_2025));
    expect(engagementRange.contains(nov30_2025)).toBe(true);
    
    // Scenario 4: Calendar week containing Nov 30
    const weekStart = CalendarDate.local(2025, 11, 24); // Monday of that week
    const weekRange = DateInterval.fromDateTimes(weekStart, nov30_2025);
    console.log('- Week range contains Nov 30:', weekRange.contains(nov30_2025));
    expect(weekRange.contains(nov30_2025)).toBe(true);
  });

  it('checks if the issue is specific to Sundays at month end', () => {
    // Find other months where the last day is a Sunday
    const sundayMonthEnds = [
      CalendarDate.local(2024, 6, 30),   // June 30, 2024
      CalendarDate.local(2023, 4, 30),   // April 30, 2023  
      CalendarDate.local(2023, 7, 30),   // July 30, 2023
      CalendarDate.local(2025, 3, 30),   // March 30, 2025
    ];
    
    sundayMonthEnds.forEach(date => {
      if (date.weekday === 7) { // Only test actual Sundays
        const monthStart = CalendarDate.local(date.year, date.month, 1);
        const monthRange = DateInterval.fromDateTimes(monthStart, date);
        
        console.log(`Testing ${date.toISO()} (Sunday):`, monthRange.contains(date));
        expect(monthRange.contains(date)).toBe(true);
      }
    });
  });

  it('checks potential edge cases around November 30, 2025', () => {
    const nov30 = CalendarDate.local(2025, 11, 30);
    const nov29 = CalendarDate.local(2025, 11, 29); // Saturday
    const dec1 = CalendarDate.local(2025, 12, 1);   // Monday
    
    // Test various interval configurations
    const intervals = [
      { name: 'Nov 29-30', interval: DateInterval.fromDateTimes(nov29, nov30) },
      { name: 'Nov 30-Dec 1', interval: DateInterval.fromDateTimes(nov30, dec1) },
      { name: 'Nov 29-Dec 1', interval: DateInterval.fromDateTimes(nov29, dec1) },
    ];
    
    intervals.forEach(({ name, interval }) => {
      const containsNov30 = interval.contains(nov30);
      console.log(`${name} contains Nov 30:`, containsNov30);
      expect(containsNov30).toBe(true);
    });
  });

  /**
   * This test specifically checks if there's an issue with how the DateInterval
   * handles the conversion to Luxon's half-open intervals when dealing with 
   * month-end Sundays.
   */
  it('tests the internal toSuper/fromSuper conversion with November 30', () => {
    const nov1 = CalendarDate.local(2025, 11, 1);
    const nov30 = CalendarDate.local(2025, 11, 30); // Sunday
    
    const dateInterval = DateInterval.fromDateTimes(nov1, nov30);
    
    // Manually replicate the toSuper logic (from date-interval.ts line 16-17)
    const luxonStart = dateInterval.start;
    const luxonEnd = dateInterval.end.plus({ days: 1 }); // Should be Dec 1
    
    console.log('Internal conversion details:');
    console.log('- DateInterval start:', luxonStart.toISO());
    console.log('- DateInterval end:', dateInterval.end.toISO());
    console.log('- Luxon interval start:', luxonStart.toISO());
    console.log('- Luxon interval end (end + 1):', luxonEnd.toISO());
    
    // Test the contains logic that's used internally
    const testResults = {
      startComparison: nov30 >= luxonStart,
      endComparison: nov30 < luxonEnd,
      combined: nov30 >= luxonStart && nov30 < luxonEnd,
      actualContains: dateInterval.contains(nov30)
    };
    
    console.log('Contains logic breakdown:');
    Object.entries(testResults).forEach(([key, value]) => {
      console.log(`- ${key}:`, value);
    });
    
    // All should be true
    expect(testResults.startComparison).toBe(true);
    expect(testResults.endComparison).toBe(true);
    expect(testResults.combined).toBe(true);
    expect(testResults.actualContains).toBe(true);
  });
});