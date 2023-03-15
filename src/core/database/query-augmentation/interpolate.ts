import { stripIndent } from 'common-tags';
import { Clause } from 'cypher-query-builder';
import { isArray, isBoolean, isNumber, isObject, isString, map } from 'lodash';
import { DateTime, Duration } from 'luxon';
import { Integer, types as neo } from 'neo4j-driver';
import { CalendarDate } from '../../../common';

/**
 * Overridden to correctly interpolate null, undefined, and temporal values.
 */
Clause.prototype.interpolate = function interpolate() {
  let query = this.build();
  query = stripIndent(query.slice(0, -1));
  const params = this.getParams();
  for (const [name, param] of Object.entries(params)) {
    const pattern = new RegExp(`\\$${name}(?![a-zA-Z0-9_])`, 'g');
    query = query.replace(pattern, stringifyValue(param));
  }
  return query;
};

function stringifyValue(value: unknown): string {
  if (value == null) {
    return 'null';
  }
  if (isNumber(value) || isBoolean(value)) {
    // This is how it's done upstream, and it works fine.
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `${value}`;
  }
  if (isString(value)) {
    return `'${value}'`;
  }
  if (isArray(value)) {
    const str = map(value, stringifyValue).join(', ');
    return `[${str}]`;
  }
  if (CalendarDate.isDate(value)) {
    return `date('${value.toISO()}')`;
  }
  if (DateTime.isDateTime(value)) {
    if (value.diffNow('minutes').minutes < 1) {
      return `datetime()`; // assume now
    }
    return `datetime('${value.toISO()}')`;
  }
  if (Duration.isDuration(value)) {
    return `duration('${value.toISO()}')`;
  }
  if (isNeoInteger(value)) {
    return neo.Integer.inSafeRange(value)
      ? `${neo.Integer.toNumber(value)}`
      : `'${neo.Integer.toString(value)}'`;
  }
  if (isObject(value)) {
    const pairs = map(
      value,
      (el, key) => `${quoteKey(key)}: ${stringifyValue(el)}`,
    );
    const str = pairs.join(', ');
    return `{ ${str} }`;
  }
  return '';
}

export const quoteKey = (key: string): string =>
  SAFE_KEY.exec(key) ? key : `\`${key}\``;
const SAFE_KEY = /^[a-zA-Z][a-zA-Z0-9]*$/;

const isNeoInteger = (value: unknown): value is Integer =>
  neo.Integer.isInteger(value as any);
