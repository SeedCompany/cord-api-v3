import { notFound } from './error-shape-helpers';

/** @deprecated */
export const expectNotFound = (action: PromiseLike<any>) =>
  expect(action).rejects.toThrowGqlError(notFound());
