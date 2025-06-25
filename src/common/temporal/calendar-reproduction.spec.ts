import { CalendarDate } from './calendar-date';
import { DateInterval } from './date-interval';

// Reproduce the exact scenario from the issue
describe('Calendar Widget Bug - Real scenario reproduction', () => {
  it('tests project date range for November 2025', () => {
    // Scenario: A project with mouStart = Nov 1, 2025 and mouEnd = Nov 30, 2025 (Sunday)
    const mouStart = CalendarDate.local(2025, 11, 1);
    const mouEnd = CalendarDate.local(2025, 11, 30);
    
    console.log('Project dates:');
    console.log('- mouStart:', mouStart.toISO(), '(weekday:', mouStart.weekday, ')');
    console.log('- mouEnd:', mouEnd.toISO(), '(weekday:', mouEnd.weekday, ')');
    
    // This is what projectRange() does
    const projectDateRange = DateInterval.tryFrom(mouStart, mouEnd);
    
    expect(projectDateRange).not.toBeNull();
    console.log('- Project range:', projectDateRange!.toString());
    
    // Test if all dates in November are "contained" in the range
    for (let day = 1; day <= 30; day++) {
      const testDate = CalendarDate.local(2025, 11, day);
      const isContained = projectDateRange!.contains(testDate);
      
      if (!isContained) {
        console.log(`❌ Date ${testDate.toISO()} (${testDate.weekdayLong}) is NOT contained in range`);
      } else if (day === 30) {
        console.log(`✅ Date ${testDate.toISO()} (${testDate.weekdayLong}) is contained in range`);
      }
      
      expect(isContained).toBe(true);
    }
  });

  it('tests engagement date range for November 2025', () => {
    // Scenario: An engagement with startDate = Nov 1, 2025 and endDate = Nov 30, 2025 (Sunday)
    const startDate = CalendarDate.local(2025, 11, 1);
    const endDate = CalendarDate.local(2025, 11, 30);
    
    console.log('Engagement dates:');
    console.log('- startDate:', startDate.toISO(), '(weekday:', startDate.weekday, ')');
    console.log('- endDate:', endDate.toISO(), '(weekday:', endDate.weekday, ')');
    
    // This is what engagementRange() does
    const engagementDateRange = DateInterval.tryFrom(startDate, endDate);
    
    expect(engagementDateRange).not.toBeNull();
    console.log('- Engagement range:', engagementDateRange!.toString());
    
    // The critical test: does the range contain the last day (Sunday)?
    const lastDay = CalendarDate.local(2025, 11, 30);
    const containsLastDay = engagementDateRange!.contains(lastDay);
    
    console.log(`- Contains last day (${lastDay.toISO()}, ${lastDay.weekdayLong}):`, containsLastDay);
    
    expect(containsLastDay).toBe(true);
  });

  it('tests potential edge case with endOf month calculation', () => {
    // Test if there's an issue with endOf('month') when the month ends on Sunday
    const nov1 = CalendarDate.local(2025, 11, 1);
    const calculatedEnd = nov1.endOf('month');
    const manualEnd = CalendarDate.local(2025, 11, 30);
    
    console.log('Month end calculation:');
    console.log('- nov1.endOf("month"):', calculatedEnd.toISO(), '(weekday:', calculatedEnd.weekday, ')');
    console.log('- Manual Nov 30:', manualEnd.toISO(), '(weekday:', manualEnd.weekday, ')');
    console.log('- Are they equal?', calculatedEnd.equals(manualEnd));
    
    expect(calculatedEnd.equals(manualEnd)).toBe(true);
    expect(calculatedEnd.weekday).toBe(7); // Should be Sunday
  });

  it('tests the specific contains method implementation', () => {
    // Let's test the DateInterval.contains() method with the exact problematic scenario
    const range = DateInterval.fromDateTimes(
      CalendarDate.local(2025, 11, 1),
      CalendarDate.local(2025, 11, 30)
    );
    
    // Test the Sunday that's causing issues
    const problemDate = CalendarDate.local(2025, 11, 30); // Sunday
    const result = range.contains(problemDate);
    
    console.log('Direct contains() test:');
    console.log('- Range:', range.toString());
    console.log('- Test date:', problemDate.toISO(), '(weekday:', problemDate.weekday, ')');
    console.log('- Contains result:', result);
    
    // Let's also manually check the internal conversion
    const luxonStart = range.start;
    const luxonEnd = range.end.plus({ days: 1 }); // This is what toSuper() does
    
    console.log('- Internal conversion:');
    console.log('  - Luxon start:', luxonStart.toISO());
    console.log('  - Luxon end (end + 1):', luxonEnd.toISO());
    console.log('  - Problem date between them?', problemDate >= luxonStart && problemDate < luxonEnd);
    
    expect(result).toBe(true);
  });
});