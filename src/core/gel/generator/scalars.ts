import { scalarToLiteralMapping } from '@gel/generate/dist/genutil.js';
import { mapEntries } from '@seedcompany/common';
import { set } from 'lodash';
import { codecs } from '../codecs';

export const customScalars = mapEntries(codecs, (codec) => [
  codec.info.ts,
  codec.info,
]).asMap;

export function setTsTypesFromOurScalarCodecs() {
  // this is used for schema interfaces & query builder
  for (const { info } of codecs) {
    const fqName = `${info.module}::${info.type}`;
    set(scalarToLiteralMapping, [fqName, 'type'], info.ts);
  }
}
