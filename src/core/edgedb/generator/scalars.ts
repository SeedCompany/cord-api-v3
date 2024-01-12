import { scalarToLiteralMapping } from '@edgedb/generate/dist/genutil.js';
import { mapEntries } from '@seedcompany/common';
import { codecs } from '../codecs';

export const customScalars = mapEntries(codecs, (codec) => [
  codec.info.ts,
  codec.info,
]).asMap;

export function setTsTypesFromOurScalarCodecs() {
  // this is used for schema interfaces & query builder
  for (const { info } of codecs) {
    const fqName = `${info.module}::${info.type}`;
    scalarToLiteralMapping[fqName].type = info.ts;
  }
}
