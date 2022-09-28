import { Query } from 'cypher-query-builder';
import { ExcessiveRows, NoRows } from '~/core/database';

declare module 'cypher-query-builder/dist/typings/query' {
  interface Query<Result = unknown> {
    /**
     * Execute the query and return the single expected row.
     * If there are no rows or multiple rows exceptions are thrown.
     *
     * @example
     * await this.db.query()
     *   ...
     *   .exactlyOne();
     *
     * @throws NoRows
     * @throws ExcessiveRows
     */
    exactlyOne(): Promise<Result>;
  }
}

Query.prototype.exactlyOne = async function exactlyOne() {
  const rows = await this.run();
  if (!rows[0]) {
    throw new NoRows('No rows returned, but we were expecting 1.');
  }
  if (rows.length > 1) {
    throw new ExcessiveRows(
      `Database returned ${rows.length}, however we were only expecting 1.
Database query should be adjusted to limit to 1 row.`
    );
  }
  return rows[0];
};
