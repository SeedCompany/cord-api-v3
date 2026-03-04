import { Query } from 'cypher-query-builder';
import { LogLevel } from '../../logger';
import { highlight } from '../highlight-cypher.util';

declare module 'cypher-query-builder/dist/typings/query' {
  interface Query {
    /**
     * Log this query execution at the given level
     * @param [level=Notice]
     * @param interpolate Whether to interpolate parameters into query.
     *                    Default is true for dev.
     */
    logIt(level?: LogLevel, interpolate?: boolean): this;
  }
}

Query.prototype.logIt = function logIt(
  this: Query,
  level = LogLevel.NOTICE,
  interpolate?: boolean,
) {
  const query = this.root;
  const orig = query.buildQueryObject.bind(query);
  query.buildQueryObject = function buildQueryObject() {
    const result = orig();
    if (interpolate ?? process.env.NODE_ENV !== 'production') {
      let interpolated = query.interpolate();
      interpolated = highlight(interpolated);
      Object.defineProperty(result.params, 'interpolated', {
        value: interpolated,
        enumerable: false,
      });
    }

    Object.defineProperty(result.params, 'logIt', {
      value: level,
      enumerable: false,
    });
    return result;
  };

  return this;
};
