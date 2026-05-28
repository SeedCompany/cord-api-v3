import { describe, expect, it } from '@jest/globals';
import { DatabaseError } from 'pg';
import { DuplicateException, InputException } from '~/common';
import { catchForeignKeyViolation, catchUniqueViolation } from './errors';

/**
 * Construct a `DatabaseError` instance with the fields the catchers inspect.
 * The `pg` driver normally builds these from wire-protocol responses; in
 * tests we instantiate directly and stamp `code`/`constraint` on the instance.
 */
const makePgError = (
  code: string,
  constraint: string,
  message = 'test error',
): DatabaseError => {
  const e = new DatabaseError(message, 0, 'error');
  Object.assign(e, { code, constraint });
  return e;
};

describe('catchForeignKeyViolation', () => {
  const catcher = catchForeignKeyViolation(
    'field_region_id_fkey',
    'fieldRegions',
    'One or more field region IDs do not exist',
  );

  it('maps a matching 23503 to InputException with the field set', () => {
    expect.assertions(3);
    try {
      catcher(
        makePgError('23503', 'partner_field_regions_field_region_id_fkey'),
      );
    } catch (e) {
      expect(e).toBeInstanceOf(InputException);
      expect((e as InputException).message).toBe(
        'One or more field region IDs do not exist',
      );
      expect((e as InputException).field).toBe('fieldRegions');
    }
  });

  it('re-throws unchanged when the constraint does not match', () => {
    const err = makePgError('23503', 'partner_countries_location_id_fkey');
    expect(() => catcher(err)).toThrow(err);
  });

  it('re-throws unchanged on a different PG error code', () => {
    const err = makePgError(
      '23505',
      'partner_field_regions_field_region_id_fkey',
    );
    expect(() => catcher(err)).toThrow(err);
  });

  it('re-throws unchanged on a non-DatabaseError', () => {
    const err = new Error('plain');
    expect(() => catcher(err)).toThrow(err);
  });
});

describe('catchUniqueViolation', () => {
  const catcher = catchUniqueViolation(
    'organization',
    'organization',
    'Partner for organization already exists.',
  );

  it('maps a matching 23505 to DuplicateException with the field set', () => {
    expect.assertions(3);
    try {
      catcher(makePgError('23505', 'partners_organization_active_unique'));
    } catch (e) {
      expect(e).toBeInstanceOf(DuplicateException);
      expect((e as DuplicateException).message).toBe(
        'Partner for organization already exists.',
      );
      expect((e as DuplicateException).field).toBe('organization');
    }
  });

  it('re-throws unchanged when the constraint does not match', () => {
    const err = makePgError('23505', 'some_other_unique_idx');
    expect(() => catcher(err)).toThrow(err);
  });

  it('re-throws unchanged on a different PG error code', () => {
    const err = makePgError('23503', 'partners_organization_active_unique');
    expect(() => catcher(err)).toThrow(err);
  });

  it('re-throws unchanged on a non-DatabaseError', () => {
    const err = new Error('plain');
    expect(() => catcher(err)).toThrow(err);
  });
});
