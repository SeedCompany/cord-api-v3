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
     */
    logIt(level?: LogLevel): this;
  }
}

Query.prototype.logIt = function logIt(this: Query, level = LogLevel.NOTICE) {
  const orig = this.buildQueryObject.bind(this);
  this.buildQueryObject = function buildQueryObject() {
    const result = orig();
    if (process.env.NODE_ENV !== 'production') {
      let interpolated = this.interpolate();
      interpolated = highlight(interpolated, {
        language: 'cypher',
      });
      Object.defineProperty(result.params, 'interpolated', {
        value: `\n${interpolated}\n`,
        enumerable: false,
      });
    }
    const trace = (this as any).__stacktrace as string[] | undefined;
    const frame = trace?.[0] ? /at (.+) \(/.exec(trace[0]) : undefined;
    if (frame?.[1]) {
      Object.defineProperty(result.params, '__origin', {
        value: frame[1],
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
