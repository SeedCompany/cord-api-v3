import { CalendarDate } from './calendar-date';
import { DateInterval } from './date-interval';

// Test the complete flow from project/engagement dates to what gets sent to frontend
describe('Calendar Widget Bug - Complete Flow Test', () => {
  it('reproduces the complete flow for November 2025 project dates', () => {
    console.log('=== Testing Complete Project Date Flow ===');
    
    // Step 1: Create project dates (what would be stored in database)
    const mouStart = CalendarDate.local(2025, 11, 1);
    const mouEnd = CalendarDate.local(2025, 11, 30); // Sunday - the problematic date
    
    console.log('Project MOU dates:');
    console.log('- mouStart:', mouStart.toISO(), '(weekday:', mouStart.weekday, ')');
    console.log('- mouEnd:', mouEnd.toISO(), '(weekday:', mouEnd.weekday, ')');
    
    // Step 2: Create date range (like projectRange() function)
    const projectRange = DateInterval.tryFrom(mouStart, mouEnd);
    
    expect(projectRange).not.toBeNull();
    console.log('- projectRange:', projectRange!.toString());
    
    // Step 3: Test if all dates in November are valid selections
    console.log('\\nTesting date containment:');
    const problematicDate = CalendarDate.local(2025, 11, 30);
    const isContained = projectRange!.contains(problematicDate);
    
    console.log('- Contains Nov 30 (Sunday):', isContained);
    expect(isContained).toBe(true);
    
    // Step 4: Test serialization (what gets sent to GraphQL/frontend)
    console.log('\\nTesting serialization:');
    console.log('- mouStart.toISO():', mouStart.toISO());
    console.log('- mouEnd.toISO():', mouEnd.toISO());
    console.log('- mouStart.toISODate():', mouStart.toISODate());
    console.log('- mouEnd.toISODate():', mouEnd.toISODate());
    
    // Step 5: Test round-trip serialization/deserialization
    console.log('\\nTesting round-trip conversion:');
    const serializedEnd = mouEnd.toISO();
    const deserializedEnd = CalendarDate.fromISO(serializedEnd);
    
    console.log('- Original mouEnd:', mouEnd.toISO(), 'weekday:', mouEnd.weekday);
    console.log('- Serialized:', serializedEnd);
    console.log('- Deserialized:', deserializedEnd.toISO(), 'weekday:', deserializedEnd.weekday);
    console.log('- Round-trip equals:', mouEnd.equals(deserializedEnd));
    
    expect(mouEnd.equals(deserializedEnd)).toBe(true);
    expect(deserializedEnd.weekday).toBe(7); // Should still be Sunday
  });

  it('tests potential timezone issues in CalendarDate creation', () => {
    console.log('=== Testing Timezone Issues ===');
    
    // Test different ways of creating the same date
    const methods = [
      { name: 'local(2025, 11, 30)', date: CalendarDate.local(2025, 11, 30) },
      { name: 'utc(2025, 11, 30)', date: CalendarDate.utc(2025, 11, 30) },
      { name: 'fromISO("2025-11-30")', date: CalendarDate.fromISO('2025-11-30') },
    ];
    
    methods.forEach(({ name, date }) => {
      console.log(`${name}:`);
      console.log('  - toISO():', date.toISO());
      console.log('  - weekday:', date.weekday);
      console.log('  - offset:', date.offset);
      console.log('  - zoneName:', date.zoneName);
    });
    
    // All should be equal and all should be Sunday
    const first = methods[0].date;
    methods.forEach(({ name, date }, index) => {
      if (index > 0) {
        expect(first.equals(date)).toBe(true, `${methods[0].name} should equal ${name}`);
      }
      expect(date.weekday).toBe(7, `${name} should be Sunday`);
    });
  });

  it('tests edge cases around month boundaries', () => {
    console.log('=== Testing Month Boundary Edge Cases ===');
    
    // Test the transition from November 30 to December 1
    const nov30 = CalendarDate.local(2025, 11, 30); // Sunday
    const dec1 = nov30.plus({ days: 1 });
    const nov29 = nov30.minus({ days: 1 });
    
    console.log('Month boundary test:');
    console.log('- Nov 29:', nov29.toISO(), 'weekday:', nov29.weekday);
    console.log('- Nov 30:', nov30.toISO(), 'weekday:', nov30.weekday);
    console.log('- Dec 1:', dec1.toISO(), 'weekday:', dec1.weekday);
    
    // Test date arithmetic around the boundary
    expect(nov30.weekday).toBe(7); // Sunday
    expect(dec1.weekday).toBe(1);  // Monday
    expect(nov29.weekday).toBe(6); // Saturday
    
    // Test interval creation across the boundary
    const crossBoundaryInterval = DateInterval.fromDateTimes(nov29, dec1);
    
    console.log('- Cross-boundary interval:', crossBoundaryInterval.toString());
    console.log('- Contains Nov 30:', crossBoundaryInterval.contains(nov30));
    console.log('- Contains Dec 1:', crossBoundaryInterval.contains(dec1));
    
    expect(crossBoundaryInterval.contains(nov30)).toBe(true);
    expect(crossBoundaryInterval.contains(dec1)).toBe(true);
  });

  it('tests the specific DateInterval conversion logic', () => {
    console.log('=== Testing DateInterval Conversion Logic ===');
    
    // Create the problematic interval
    const interval = DateInterval.fromDateTimes(
      CalendarDate.local(2025, 11, 1),
      CalendarDate.local(2025, 11, 30)
    );
    
    // Manually replicate the toSuper() conversion logic
    const start = interval.start;
    const endPlusOne = interval.end.plus({ days: 1 });
    
    console.log('Conversion details:');
    console.log('- Original interval:', interval.toString());
    console.log('- Start date:', start.toISO());
    console.log('- End date:', interval.end.toISO());
    console.log('- End + 1 day:', endPlusOne.toISO());
    
    // Test the contains logic manually
    const testDate = CalendarDate.local(2025, 11, 30);
    const manualContains = testDate >= start && testDate < endPlusOne;
    const actualContains = interval.contains(testDate);
    
    console.log('- Test date:', testDate.toISO());
    console.log('- testDate >= start:', testDate >= start);
    console.log('- testDate < endPlusOne:', testDate < endPlusOne);
    console.log('- Manual contains:', manualContains);
    console.log('- Actual contains:', actualContains);
    
    expect(manualContains).toBe(true);
    expect(actualContains).toBe(true);
    expect(manualContains).toBe(actualContains);
  });
});