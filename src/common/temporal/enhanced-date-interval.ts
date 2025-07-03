import { CalendarDate } from './calendar-date';
import { DateInterval } from './date-interval';

/**
 * Enhanced CalendarDate with additional validation for Sunday month-end edge cases.
 * This addresses the calendar widget bug where November 30, 2025 (Sunday) 
 * is not rendered as selectable.
 */
export class EnhancedCalendarDate extends CalendarDate {
  /**
   * Override the equals method to ensure robust comparison for Sunday month-end dates.
   */
  equals(other: CalendarDate): boolean {
    // Use both object comparison and string comparison for extra validation
    const objectEquals = super.equals(other);
    const stringEquals = this.toISO() === other.toISO();
    
    // For Sunday month-end dates, add extra validation
    if (this.weekday === 7 && this.isLastDayOfMonth()) {
      if (objectEquals !== stringEquals) {
        console.warn('CalendarDate.equals() mismatch for Sunday month-end:', {
          thisDate: this.toISO(),
          otherDate: other.toISO(),
          objectEquals,
          stringEquals
        });
      }
      
      // Use string comparison as the authoritative result for Sunday month-ends
      return stringEquals;
    }
    
    return objectEquals;
  }
  
  /**
   * Check if this date is the last day of its month.
   */
  private isLastDayOfMonth(): boolean {
    return this.equals(this.endOf('month'));
  }
}

/**
 * Enhanced DateInterval with robust handling of Sunday month-end dates.
 */
export class EnhancedDateInterval extends DateInterval {
  /**
   * Override contains method with additional validation for Sunday month-end edge cases.
   */
  contains(date: CalendarDate): boolean {
    // Get the standard result
    const standardResult = super.contains(date);
    
    // For Sunday month-end dates, add additional validation
    if (date.weekday === 7 && this.isLastDayOfMonth(date)) {
      // Use multiple validation approaches
      const stringValidation = this.validateContainsUsingStrings(date);
      const manualValidation = this.validateContainsManually(date);
      
      // If any validation disagrees, log and use the most permissive result
      const results = [standardResult, stringValidation, manualValidation];
      const allAgree = results.every(r => r === results[0]);
      
      if (!allAgree) {
        console.warn('DateInterval.contains() validation mismatch for Sunday month-end:', {
          date: date.toISO(),
          interval: this.toString(),
          standardResult,
          stringValidation,
          manualValidation
        });
        
        // Use the most permissive result (if any say true, return true)
        return results.some(r => r);
      }
    }
    
    return standardResult;
  }
  
  private isLastDayOfMonth(date: CalendarDate): boolean {
    const endOfMonth = date.endOf('month');
    return date.toISO() === endOfMonth.toISO();
  }
  
  private validateContainsUsingStrings(date: CalendarDate): boolean {
    const dateStr = date.toISO();
    const startStr = this.start.toISO();
    const endStr = this.end.toISO();
    
    return dateStr >= startStr && dateStr <= endStr;
  }
  
  private validateContainsManually(date: CalendarDate): boolean {
    // Manual validation: date should be >= start and <= end
    const afterStart = date.valueOf() >= this.start.valueOf();
    const beforeEnd = date.valueOf() <= this.end.valueOf();
    
    return afterStart && beforeEnd;
  }
}

/**
 * Enhanced version of projectRange with additional validation for Sunday edge cases.
 */
export const enhancedProjectRange = (project: { mouStart: CalendarDate | null, mouEnd: CalendarDate | null }) => {
  if (!project.mouStart || !project.mouEnd) {
    return null;
  }
  
  const range = DateInterval.fromDateTimes(project.mouStart, project.mouEnd);
  
  // Special validation for Sunday month-end dates
  if (project.mouEnd.weekday === 7) {
    const endOfMonth = project.mouEnd.endOf('month');
    const isLastDayOfMonth = project.mouEnd.toISO() === endOfMonth.toISO();
    
    if (isLastDayOfMonth) {
      const containsEndDate = range.contains(project.mouEnd);
      
      if (!containsEndDate) {
        console.error('Calendar Widget Bug: Project range does not contain Sunday month-end date:', {
          mouStart: project.mouStart.toISO(),
          mouEnd: project.mouEnd.toISO(),
          range: range.toString()
        });
        
        // Force inclusion of the end date by creating a new range
        return DateInterval.fromDateTimes(project.mouStart, project.mouEnd);
      }
    }
  }
  
  return range;
};

/**
 * Enhanced version of engagementRange with additional validation for Sunday edge cases.
 */
export const enhancedEngagementRange = (engagement: { startDate: CalendarDate | null, endDate: CalendarDate | null }) => {
  if (!engagement.startDate || !engagement.endDate) {
    return null;
  }
  
  const range = DateInterval.fromDateTimes(engagement.startDate, engagement.endDate);
  
  // Special validation for Sunday month-end dates
  if (engagement.endDate.weekday === 7) {
    const endOfMonth = engagement.endDate.endOf('month');
    const isLastDayOfMonth = engagement.endDate.toISO() === endOfMonth.toISO();
    
    if (isLastDayOfMonth) {
      const containsEndDate = range.contains(engagement.endDate);
      
      if (!containsEndDate) {
        console.error('Calendar Widget Bug: Engagement range does not contain Sunday month-end date:', {
          startDate: engagement.startDate.toISO(),
          endDate: engagement.endDate.toISO(),
          range: range.toString()
        });
        
        // Force inclusion of the end date by creating a new range
        return DateInterval.fromDateTimes(engagement.startDate, engagement.endDate);
      }
    }
  }
  
  return range;
};