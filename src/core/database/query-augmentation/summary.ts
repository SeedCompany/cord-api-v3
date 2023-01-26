import { Connection, Query } from 'cypher-query-builder';
import { ResultSummary } from 'neo4j-driver';
import { Stats } from 'neo4j-driver-core';

declare module 'cypher-query-builder/dist/typings/connection' {
  interface Connection {
    /**
     * Execute query and return summary.
     */
    executeAndReturnSummary(query: Query): Promise<ResultSummary>;
  }
}

declare module 'cypher-query-builder/dist/typings/query' {
  interface Query {
    /**
     * Execute query and return summary.
     */
    executeAndReturnSummary(): Promise<ResultSummary>;
    /**
     * Execute query and return stats.
     */
    executeAndReturnStats(): Promise<Stats>;
  }
}

// Same body as `connection.run` other than the `summary()` call
Connection.prototype.executeAndReturnSummary =
  async function executeAndReturnSummary(this: Connection, query: Query) {
    if (!this.open) {
      throw new Error('Cannot run query; connection is not open.');
    }

    if (query.getClauses().length === 0) {
      throw new Error('Cannot run query: no clauses attached to the query.');
    }

    const session = this.session();
    if (!session) {
      throw new Error('Cannot run query: connection is not open.');
    }

    const queryObj = query.buildQueryObject();

    try {
      return await session.run(queryObj.query, queryObj.params).summary();
    } finally {
      await session.close();
    }
  };

// Same body as `Query.run` just a different connection call.
Query.prototype.executeAndReturnSummary =
  async function executeAndReturnSummary(this: Query) {
    if (!this.connection) {
      throw new Error('Cannot run query; no connection object available.');
    }

    return await this.connection.executeAndReturnSummary(this);
  };

Query.prototype.executeAndReturnStats = async function executeAndReturnStats(
  this: Query
) {
  const summary = await this.executeAndReturnSummary();
  return summary.updateStatistics.updates();
};
