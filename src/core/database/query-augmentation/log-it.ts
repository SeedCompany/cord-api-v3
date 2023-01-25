import { highlight } from 'cli-highlight';
import { Query } from 'cypher-query-builder';
import { registerLanguage } from 'highlight.js';
import { LogLevel } from '../../logger';

if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports,@typescript-eslint/no-var-requires
  registerLanguage('cypher', require('highlightjs-cypher'));
}

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
  interpolate?: boolean
) {
  const query = this.root;
  const orig = query.buildQueryObject.bind(query);
  query.buildQueryObject = function buildQueryObject() {
    const result = orig();
    if (interpolate ?? process.env.NODE_ENV !== 'production') {
      let interpolated = query.interpolate();
      interpolated = highlight(interpolated, {
        language: 'cypher',
      });
      Object.defineProperty(result.params, 'interpolated', {
        value: `\n${interpolated}\n`,
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
