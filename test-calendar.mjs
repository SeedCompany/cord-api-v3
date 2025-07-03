import { CalendarDate } from '../src/common/temporal/calendar-date';
import { DateInterval } from '../src/common/temporal/date-interval';

// Test for November 2025 - should end on Sunday November 30, 2025
const november2025Start = CalendarDate.local(2025, 11, 1);
const november2025End = november2025Start.endOf('month');

console.log('November 2025 Calendar Test:');
console.log('Start:', november2025Start.toISO());
console.log('End:', november2025End.toISO());
console.log('End weekday:', november2025End.weekday, '(7 = Sunday)');

// Create a date interval for the whole month
const november2025Interval = DateInterval.fromDateTimes(november2025Start, november2025End);
console.log('Interval:', november2025Interval.toString());

// Test if the last day (Sunday) is contained in the interval
const lastDay = CalendarDate.local(2025, 11, 30);
console.log('Last day (Nov 30):', lastDay.toISO());
console.log('Last day weekday:', lastDay.weekday, '(7 = Sunday)');
console.log('Interval contains last day:', november2025Interval.contains(lastDay));

// Test some other dates for comparison
const nov29 = CalendarDate.local(2025, 11, 29);
console.log('Nov 29 contained:', november2025Interval.contains(nov29));

const dec1 = CalendarDate.local(2025, 12, 1);
console.log('Dec 1 contained:', november2025Interval.contains(dec1));

// Test creating intervals that end on Sundays
console.log('\nTesting intervals ending on Sundays:');

// Manual test: Create an interval ending on a Sunday
const sundayEndInterval = DateInterval.fromDateTimes(
  CalendarDate.local(2025, 11, 24), // Monday
  CalendarDate.local(2025, 11, 30)  // Sunday
);

console.log('Week interval ending on Sunday:', sundayEndInterval.toString());
console.log('Contains Sunday (Nov 30):', sundayEndInterval.contains(CalendarDate.local(2025, 11, 30)));
console.log('Contains Monday (Nov 24):', sundayEndInterval.contains(CalendarDate.local(2025, 11, 24)));