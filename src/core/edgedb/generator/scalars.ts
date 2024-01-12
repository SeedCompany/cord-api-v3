import { scalarToLiteralMapping } from '@edgedb/generate/dist/genutil.js';
import { mapEntries } from '@seedcompany/common';
import { SCALAR_CODECS } from 'edgedb/dist/codecs/codecs.js';
import { KNOWN_TYPENAMES } from 'edgedb/dist/codecs/consts.js';
import { codecs } from '../codecs';

export const customScalars = mapEntries(codecs, (codec) => [
  codec.info.ts,
  codec.info,
]).asMap;

export function changeScalarCodecsToOurCustomTypes() {
  for (const codec of codecs) {
    const fqName = `${codec.info.module}::${codec.info.type}`;

    // codecs are used for edgeql files & inline queries ($.analyzeQuery)
    const id = KNOWN_TYPENAMES.get(fqName);
    id && SCALAR_CODECS.set(id, new codec(id));

    // this is used for schema interfaces
    scalarToLiteralMapping[fqName].type = codec.info.ts;
  }
}
