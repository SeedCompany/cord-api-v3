import type { Many } from '@seedcompany/common';

export abstract class LiveQueryStore {
  /**
   * Invalidate queries (and schedule their re-execution) via a resource identifier.
   *
   * @param identifiers A single or list of resource identifiers that should be invalidated.
   *
   * @example
   *   // Invalidate all operations whose latest execution result contains the given user
   *   `User:${user.id}`
   *   // Invalidate query operations that select the Query, user field with the id argument
   *   `Query.user(id:"${user.id}")`
   *   // invalidate a list of all users (redundant with previous invalidations)
   *   `Query.users`
   */
  abstract invalidate(identifiers: Many<string>): void;
}
