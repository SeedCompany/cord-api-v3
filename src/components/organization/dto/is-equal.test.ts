import { Address } from './address.dto';
import { isAddressEqual } from './is-equal';

describe('isAddressEqual', () => {
  it('returns true if both are falsy', () => {
    expect(isAddressEqual(undefined, undefined)).toBe(true);
  });

  it('returns false if only one is falsy', () => {
    expect(
      isAddressEqual(undefined, { city: 'London' } satisfies Partial<Address>),
    ).toBe(false);
    expect(
      isAddressEqual({ city: 'London' } satisfies Partial<Address>, undefined),
    ).toBe(false);
  });

  it('returns true if all properties are equal', () => {
    const a = {
      addressOne: '123 Main St',
      addressTwo: 'Apt 2',
      city: 'New York',
      state: 'NY',
      zip: '12345',
      country: 'USA',
    };
    const b = {
      addressOne: '123 Main St',
      addressTwo: 'Apt 2',
      city: 'New York',
      state: 'NY',
      zip: '12345',
      country: 'USA',
    };
    expect(isAddressEqual(a, b)).toBe(true);
  });

  it('returns false if any properties are different', () => {
    const a = {
      addressOne: '123 Main St',
      addressTwo: 'Apt 2',
      city: 'New York',
      state: 'NY',
      zip: '12345',
      country: 'USA',
    };
    const b = {
      addressOne: '123 Main St',
      addressTwo: 'Apt 2',
      city: 'New York',
      state: 'NY',
      zip: '12345',
      country: 'Canada',
    };
    expect(isAddressEqual(a, b)).toBe(false);
  });
});
