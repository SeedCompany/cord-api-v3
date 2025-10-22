import { EnhancedResource, type ID } from '~/common';
import type { ResourceLike } from '~/core/resources';

export abstract class LiveQueryStore {
  /**
   * Invalidate queries (and schedule their re-execution) via a resource identifier.
   *
   * @example
   * ```ts
   * // Invalidate all operations whose latest execution result contains the given user
   * `User:${user.id}`
   * // or
   * [User, user.id]
   *
   * // Invalidate query operations that select the Query, user field with the id argument
   * `Query.user(id:"${user.id}")`
   *
   * // invalidate a list of all users (redundant with previous invalidations)
   * `Query.users`
   * ```
   */
  invalidate(identifier: string | readonly [res: ResourceLike, id: ID]) {
    this.invalidateAll([identifier]);
  }

  /**
   * Invalidate multiple identifiers.
   * @see invalidate
   */
  invalidateAll(
    identifiers: ReadonlyArray<string | readonly [res: ResourceLike, id: ID]>,
  ) {
    this.doInvalidate(
      identifiers.map((input) => {
        if (typeof input === 'string') {
          return input;
        }
        const [resLike, id] = input;
        const res = EnhancedResource.resolve(resLike);
        return `${res.name}:${id}`;
      }),
    );
  }

  protected abstract doInvalidate(identifiers: string[]): void;
}
