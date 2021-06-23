import { Query } from 'cypher-query-builder';
import { LogLevel } from '../../logger';

declare module 'cypher-query-builder/dist/typings/query' {
  interface Query {
    /**
     * Log this query execution at the given level
     * @param [level=Notice]
     */
    logIt(level?: LogLevel): this;
  }
}

Query.prototype.logIt = function logIt(this: Query, level = LogLevel.NOTICE) {
  const orig = this.buildQueryObject.bind(this);
  this.buildQueryObject = function buildQueryObject() {
    const result = orig();
    if (process.env.NODE_ENV !== 'production') {
      const interpolated = this.interpolate();
      Object.defineProperty(result.params, 'interpolated', {
        value: `\n\n${interpolated}\n\n`,
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
