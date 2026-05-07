/**
 * Escape user input so it can be safely embedded as an `ILIKE`/`LIKE` pattern.
 * Backslashes the SQL pattern wildcards (`%`, `_`) and the escape character
 * itself so they match literally instead of as wildcards.
 *
 * @example
 *   ilike(users.name, `%${escapeLikePattern(input)}%`)
 */
export const escapeLikePattern = (value: string) =>
  value.replace(/[%_\\]/g, '\\$&');
