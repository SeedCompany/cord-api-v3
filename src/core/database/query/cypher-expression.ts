import { Many, ServerException } from '../../../common';
import { quoteKey } from '../query-augmentation/interpolate';

export type ExpressionInput =
  | Many<string | boolean | number | null | undefined>
  | readonly ExpressionInput[]
  | { [prop: string]: ExpressionInput }
  | CypherExpression;

export type CypherExpression = string & {
  /**
   * Alias this expression as the given name.
   */
  as: (output: string) => string;
};

export const exp = (exp: ExpressionInput): CypherExpression => {
  if (isExp(exp)) {
    return exp;
  }
  const expression = buildExp(exp);
  return new Proxy<any>(
    {},
    {
      get(target: never, p: PropertyKey): any {
        if (p === 'as') {
          return (output: string) => `${expression} as ${output}`;
        }
        if (p === CypherExp) {
          return true;
        }
        if (
          p === Symbol.toPrimitive ||
          p === Symbol.toStringTag ||
          p === 'toString'
        ) {
          return () => expression;
        }
        throw new ServerException('Something went wrong');
      },
    }
  );
};

export const isExp = (value: unknown): value is CypherExpression =>
  // @ts-expect-error I know indexes and symbols. how hard is it.
  value && typeof value === 'object' && value[CypherExp] === true;

const CypherExp = Symbol('CypherExpression');

const isArray = (arg: unknown): arg is readonly unknown[] => Array.isArray(arg);
const buildExp = (exp: ExpressionInput): string => {
  if (exp == null) {
    return 'null';
  }
  if (typeof exp === 'number' || typeof exp === 'boolean') {
    return exp.toString();
  }
  if (typeof exp === 'string') {
    return exp; // string literals must be quoted explicitly
  }
  if (isExp(exp)) {
    return exp.toString();
  }

  if (isArray(exp)) {
    const list = exp.filter((e) => e !== undefined).map(buildExp);
    return shouldMultiline(list)
      ? `[${makeMultiline(list)}]`
      : `[${list.join(', ')}]`;
  }

  const pairs = Object.entries(exp).flatMap(([key, value]) =>
    value !== undefined ? `${quoteKey(key)}: ${buildExp(value)}` : []
  );
  return shouldMultiline(pairs)
    ? `{${makeMultiline(pairs)}}`
    : `{ ${pairs.join(', ')} }`;
};

const shouldMultiline = (list: string[]) => {
  const joined = list.join(', ');
  return joined.includes('\n') || joined.length > 80;
};
const makeMultiline = (list: string[]) =>
  `\n  ${list.map((item) => item.replace(/\n/g, `\n  `)).join(',\n  ')}\n`;
