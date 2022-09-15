import { ErrorExpectations as Expectations } from './expect-gql-error';

const extend =
  (defaults: Expectations) =>
  (extra?: Expectations): Expectations => ({
    ...defaults,
    ...extra,
  });

export const validation = (errors: Record<string, any>): Expectations => ({
  code: ['Validation', 'Client'],
  message: 'Input validation failed',
  errors,
});

export const invalidId = (field = 'id'): Expectations =>
  validation({
    [field]: { IsId: 'Invalid ID' },
  });

export const input = extend({ code: 'Input' });

export const duplicate = extend({ code: ['Duplicate', 'Input'] });

export const notFound = extend({ code: 'NotFound' });

export const schema = extend({ code: ['GraphQL', 'Client'] });
