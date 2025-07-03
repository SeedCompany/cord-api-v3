import { CalendarDate } from './calendar-date';
import { DateInterval } from './date-interval';

/**
 * Enhanced DateInterval with additional logging and validation
 * to help debug the calendar widget issue.
 * 
 * This is a potential fix that adds more robust validation around
 * the contains() method, especially for edge cases involving
 * Sunday dates at month boundaries.
 */
export class DebugDateInterval extends DateInterval {
  // Override the contains method to add debugging and validation
  contains(date: CalendarDate): boolean {
    // Call the original implementation
    const originalResult = super.contains(date);
    
    // Add special validation for potential edge cases
    const isLastDayOfMonth = this.isLastDayOfMonth(date);
    const isSunday = date.weekday === 7;
    
    // If this is a Sunday that's the last day of the month, add extra validation
    if (isSunday && isLastDayOfMonth) {
      const debugResult = this.debugContains(date);
      
      if (originalResult !== debugResult) {
        console.warn('DateInterval.contains() mismatch detected:', {
          date: date.toISO(),
          weekday: date.weekdayLong,
          isLastDayOfMonth,
          originalResult,
          debugResult,
          interval: this.toString()
        });
      }
    }
    
    return originalResult;
  }
  
  private isLastDayOfMonth(date: CalendarDate): boolean {
    const endOfMonth = date.endOf('month');
    return date.equals(endOfMonth);
  }
  
  private debugContains(date: CalendarDate): boolean {
    // Manual implementation of the contains logic with extra precision
    const start = this.start;
    const end = this.end;
    
    // Ensure we're comparing CalendarDate instances (not DateTime with time components)
    const normalizedDate = CalendarDate.fromISO(date.toISO());
    const normalizedStart = CalendarDate.fromISO(start.toISO());
    const normalizedEnd = CalendarDate.fromISO(end.toISO());
    
    // Use string comparison as a fallback
    const dateStr = normalizedDate.toISO();
    const startStr = normalizedStart.toISO();
    const endStr = normalizedEnd.toISO();
    
    const stringComparison = dateStr >= startStr && dateStr <= endStr;
    const objectComparison = normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd;
    
    if (stringComparison !== objectComparison) {
      console.warn('String vs object comparison mismatch:', {
        date: dateStr,
        start: startStr,
        end: endStr,
        stringComparison,
        objectComparison
      });
    }
    
    return stringComparison && objectComparison;
  }
}

/**
 * Enhanced projectRange function with debugging for Sunday edge cases
 */
export const debugProjectRange = (project: { mouStart: CalendarDate | null, mouEnd: CalendarDate | null }) => {
  const range = DateInterval.tryFrom(project.mouStart, project.mouEnd);
  
  if (range && project.mouEnd) {
    const isLastDayOfMonth = project.mouEnd.equals(project.mouEnd.endOf('month'));
    const isSunday = project.mouEnd.weekday === 7;
    
    if (isSunday && isLastDayOfMonth) {
      const containsEndDate = range.contains(project.mouEnd);
      
      if (!containsEndDate) {
        console.error('Calendar Widget Bug Detected:', {
          message: 'Project range does not contain its own end date',
          project: {
            mouStart: project.mouStart?.toISO(),
            mouEnd: project.mouEnd?.toISO(),
            mouEndWeekday: project.mouEnd?.weekdayLong
          },
          range: range.toString(),
          containsEndDate
        });
      }
    }
  }
  
  return range;
};

/**
 * Enhanced engagementRange function with debugging for Sunday edge cases
 */
export const debugEngagementRange = (engagement: { startDate: CalendarDate | null, endDate: CalendarDate | null }) => {
  const range = DateInterval.tryFrom(engagement.startDate, engagement.endDate);
  
  if (range && engagement.endDate) {
    const isLastDayOfMonth = engagement.endDate.equals(engagement.endDate.endOf('month'));
    const isSunday = engagement.endDate.weekday === 7;
    
    if (isSunday && isLastDayOfMonth) {
      const containsEndDate = range.contains(engagement.endDate);
      
      if (!containsEndDate) {
        console.error('Calendar Widget Bug Detected:', {
          message: 'Engagement range does not contain its own end date',
          engagement: {
            startDate: engagement.startDate?.toISO(),
            endDate: engagement.endDate?.toISO(),
            endDateWeekday: engagement.endDate?.weekdayLong
          },
          range: range.toString(),
          containsEndDate
        });
      }
    }
  }
  
  return range;
};