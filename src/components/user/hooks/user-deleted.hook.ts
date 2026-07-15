import { type ID } from '~/common';

/** Fired after a user is (soft-)deleted, in the same transaction. */
export class UserDeletedHook {
  constructor(readonly id: ID<'User'>) {}
}
