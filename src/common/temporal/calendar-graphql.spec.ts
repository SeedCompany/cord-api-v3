import { CalendarDate } from './calendar-date';
import { DateInterval } from './date-interval';

// Mock SecuredDateRange.fromPair since it's imported from another module
interface Secured<T> {
  value?: T;
  canRead: boolean;
  canEdit: boolean;
}

interface DateRange {
  start: CalendarDate | null;
  end: CalendarDate | null;
}

interface SecuredDateRange extends Secured<DateRange> {}

const mockSecuredDateRange = {
  fromPair: (
    start: Secured<CalendarDate | null>,
    end: Secured<CalendarDate | null>
  ): SecuredDateRange => {
    const canRead = start.canRead && end.canRead;
    return {
      canRead,
      canEdit: start.canEdit && end.canEdit,
      value: {
        start: canRead ? start.value ?? null : null,
        end: canRead ? end.value ?? null : null,
      },
    };
  }
};

// Test the exact GraphQL resolver logic
describe('Calendar Widget Bug - GraphQL Resolver Logic', () => {
  it('tests engagement dateRange resolver with November 2025', () => {
    console.log('=== Testing Engagement DateRange Resolver ===');
    
    // Mock engagement with November 2025 dates
    const mockEngagement = {
      startDate: {
        value: CalendarDate.local(2025, 11, 1),
        canRead: true,
        canEdit: true
      },
      endDate: {
        value: CalendarDate.local(2025, 11, 30), // Sunday - the problematic date
        canRead: true,
        canEdit: true
      }
    };
    
    console.log('Mock engagement dates:');
    console.log('- startDate:', mockEngagement.startDate.value?.toISO());
    console.log('- endDate:', mockEngagement.endDate.value?.toISO(), '(weekday:', mockEngagement.endDate.value?.weekday, ')');
    
    // This is exactly what the engagement resolver does
    const dateRange = mockSecuredDateRange.fromPair(
      mockEngagement.startDate,
      mockEngagement.endDate
    );
    
    console.log('Resolved dateRange:');
    console.log('- canRead:', dateRange.canRead);
    console.log('- canEdit:', dateRange.canEdit);
    console.log('- value.start:', dateRange.value?.start?.toISO());
    console.log('- value.end:', dateRange.value?.end?.toISO());
    
    expect(dateRange.canRead).toBe(true);
    expect(dateRange.value?.start?.toISO()).toBe('2025-11-01');
    expect(dateRange.value?.end?.toISO()).toBe('2025-11-30');
    expect(dateRange.value?.end?.weekday).toBe(7); // Should be Sunday
  });

  it('tests project mouRange resolver with November 2025', () => {
    console.log('=== Testing Project MouRange Resolver ===');
    
    // Mock project with November 2025 dates
    const mockProject = {
      mouStart: {
        value: CalendarDate.local(2025, 11, 1),
        canRead: true,
        canEdit: true
      },
      mouEnd: {
        value: CalendarDate.local(2025, 11, 30), // Sunday - the problematic date
        canRead: true,
        canEdit: true
      }
    };
    
    console.log('Mock project dates:');
    console.log('- mouStart:', mockProject.mouStart.value?.toISO());
    console.log('- mouEnd:', mockProject.mouEnd.value?.toISO(), '(weekday:', mockProject.mouEnd.value?.weekday, ')');
    
    // This is exactly what the project resolver does
    const mouRange = mockSecuredDateRange.fromPair(
      mockProject.mouStart,
      mockProject.mouEnd
    );
    
    console.log('Resolved mouRange:');
    console.log('- canRead:', mouRange.canRead);
    console.log('- canEdit:', mouRange.canEdit);
    console.log('- value.start:', mouRange.value?.start?.toISO());
    console.log('- value.end:', mouRange.value?.end?.toISO());
    
    expect(mouRange.canRead).toBe(true);
    expect(mouRange.value?.start?.toISO()).toBe('2025-11-01');
    expect(mouRange.value?.end?.toISO()).toBe('2025-11-30');
    expect(mouRange.value?.end?.weekday).toBe(7); // Should be Sunday
  });

  it('tests what happens when permissions restrict access', () => {
    console.log('=== Testing Permission-Restricted Dates ===');
    
    // Mock engagement where user can't read end date
    const mockEngagement = {
      startDate: {
        value: CalendarDate.local(2025, 11, 1),
        canRead: true,
        canEdit: true
      },
      endDate: {
        value: CalendarDate.local(2025, 11, 30), // Sunday
        canRead: false, // User can't read this!
        canEdit: false
      }
    };
    
    const dateRange = mockSecuredDateRange.fromPair(
      mockEngagement.startDate,
      mockEngagement.endDate
    );
    
    console.log('Permission-restricted result:');
    console.log('- canRead:', dateRange.canRead);
    console.log('- value.start:', dateRange.value?.start);
    console.log('- value.end:', dateRange.value?.end);
    
    // When permissions restrict access, both dates become null
    expect(dateRange.canRead).toBe(false);
    expect(dateRange.value?.start).toBe(null);
    expect(dateRange.value?.end).toBe(null);
  });

  it('tests date serialization for GraphQL output', () => {
    console.log('=== Testing GraphQL Serialization ===');
    
    const problemDate = CalendarDate.local(2025, 11, 30); // Sunday
    
    // Test how the date would be serialized for GraphQL
    const serializedISO = problemDate.toISO();
    const serializedISODate = problemDate.toISODate();
    
    console.log('Serialization results:');
    console.log('- toISO():', serializedISO);
    console.log('- toISODate():', serializedISODate);
    console.log('- weekday:', problemDate.weekday);
    
    // Both should be the same for CalendarDate
    expect(serializedISO).toBe(serializedISODate);
    expect(serializedISO).toBe('2025-11-30');
    
    // Test round-trip
    const deserialized = CalendarDate.fromISO(serializedISO);
    expect(deserialized.equals(problemDate)).toBe(true);
    expect(deserialized.weekday).toBe(7); // Should still be Sunday
  });
});