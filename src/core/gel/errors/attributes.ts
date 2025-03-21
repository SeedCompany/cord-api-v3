import { cacheable, setOf } from '@seedcompany/common';
import { GelError } from 'gel';
import { ErrorAttr } from 'gel/dist/errors/base.js';
import { lazyRecord } from '~/common/lazy-record';

type TypedAttrs = Partial<{
  hint: string;
  details: string;
  serverTraceback: string;
  positionStart: number;
  positionEnd: number;
  lineStart: number;
  columnStart: number;
  utf16ColumnStart: number;
  lineEnd: number;
  columnEnd: number;
  utf16ColumnEnd: number;
  characterStart: number;
  characterEnd: number;
}>;

const allKeys = Object.values(ErrorAttr).filter(
  (key): key is keyof TypedAttrs => typeof key === 'string',
);
const numKeys = setOf(
  allKeys.filter((key) => key.endsWith('Start') || key.endsWith('End')),
);

const cache = new WeakMap<GelError, TypedAttrs>();

export const attributesOf = cacheable(cache, (e) => {
  // @ts-expect-error it is a private field
  const attrs: Map<ErrorAttr, unknown> = e._attrs;
  const keys = new Set(
    [...attrs.keys()].map((k) => ErrorAttr[k] as keyof TypedAttrs),
  );
  return lazyRecord({
    getKeys: () => keys,
    calculate: (key) => {
      const num = ErrorAttr[key];
      if (!attrs.has(num)) {
        return undefined;
      }
      const value = attrs.get(num);
      const parse = numKeys.has(key) ? tryParseInt : readAttrStr;
      return parse(value);
    },
  });
});

function tryParseInt(value: unknown) {
  if (value == null) {
    return undefined;
  }
  try {
    return parseInt(
      value instanceof Uint8Array ? utf8Decoder.decode(value) : String(value),
      10,
    );
  } catch {
    return undefined;
  }
}
function readAttrStr(value: unknown) {
  return value instanceof Uint8Array
    ? utf8Decoder.decode(value)
    : value
    ? String(value)
    : '';
}
const utf8Decoder = new TextDecoder('utf8');
