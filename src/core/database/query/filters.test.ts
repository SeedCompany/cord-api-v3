import { comparisonOfDateTimeFilter } from './filters';

describe('filters', () => {
  describe('comparisonOfDateTimeFilter', () => {
    it('returns undefined if no parameters are provided', () => {
      const result = comparisonOfDateTimeFilter({});
      expect(result).toBeUndefined();
    });

    // it('returns between if both after and before are provided', () => {
    //   const result = comparisonOfDateTimeFilter({
    //     after: DateTime.fromISO('2022-01-01T00:00:00.000Z'),
    //     before: DateTime.fromISO('2022-01-31T23:59:59.999Z'),
    //   });
    //   expect(result).toEqual(
    //     expect.objectContaining({ between: expect.any(Array) }),
    //   );
    // });

    // it('returns greaterThanOrEqualTo if only after is provided', () => {
    //   const result = comparisonOfDateTimeFilter({
    //     after: DateTime.fromISO('2022-01-01T00:00:00.000Z'),
    //   });
    //   expect(result).toEqual(
    //     expect.objectContaining({ greaterThanOrEqualTo: expect.any(String) }),
    //   );
    // });

    // it('returns lessThanOrEqualTo if only before is provided', () => {
    //   const result = comparisonOfDateTimeFilter({
    //     before: DateTime.fromISO('2022-01-01T00:00:00.000Z'),
    //   });
    //   expect(result).toEqual(
    //     expect.objectContaining({ lessThanOrEqualTo: expect.any(String) }),
    //   );
    // });

    // it('returns between if both after and before are the same', () => {
    //   const result = comparisonOfDateTimeFilter({
    //     after: DateTime.fromISO('2022-01-01T00:00:00.000Z'),
    //     before: DateTime.fromISO('2022-01-01T00:00:00.000Z'),
    //   });
    //   expect(result).toEqual(
    //     expect.objectContaining({ between: expect.any(Array) }),
    //   );
    // });

    // it('returns between if both after and before are undefined', () => {
    //   const result = comparisonOfDateTimeFilter({
    //     after: undefined,
    //     before: undefined,
    //   });
    //   expect(result).toEqual(
    //     expect.objectContaining({ between: expect.any(Array) }),
    //   );
    // });

    // it('returns greaterThanOrEqualTo if both after and before are the same and inclusive is true', () => {
    //   const result = comparisonOfDateTimeFilter({
    //     afterInclusive: DateTime.fromISO('2022-01-01T00:00:00.000Z'),
    //     beforeInclusive: DateTime.fromISO('2022-01-01T00:00:00.000Z'),
    //   });
    //   expect(result).toEqual(
    //     expect.objectContaining({ greaterThanOrEqualTo: expect.any(String) }),
    //   );
    // });

    // it('returns lessThanOrEqualTo if both after and before are the same and inclusive is false', () => {
    //   const result = comparisonOfDateTimeFilter({
    //     after: DateTime.fromISO('2022-01-01T00:00:00.000Z'),
    //     before: DateTime.fromISO('2022-01-01T00:00:00.000Z'),
    //   });
    //   expect(result).toEqual(
    //     expect.objectContaining({ lessThanOrEqualTo: expect.any(String) }),
    //   );
    // });
  });
});
