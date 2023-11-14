import { scalarToLiteralMapping } from '@edgedb/generate/dist/genutil.js';
import { mapKeys } from '@seedcompany/common';
import { SCALAR_CODECS } from 'edgedb/dist/codecs/codecs.js';
import { KNOWN_TYPENAMES } from 'edgedb/dist/codecs/consts.js';

export const customScalars = mapKeys.fromList(
  [
    { module: 'std', type: 'uuid', ts: 'ID', path: '~/common' },
    { module: 'std', type: 'datetime', ts: 'DateTime', path: 'luxon' },
    {
      module: 'cal',
      type: 'local_date',
      ts: 'CalendarDate',
      path: '~/common',
    },
  ] satisfies CustomScalar[],
  (s) => s.ts,
).asMap;

export interface CustomScalar {
  module: string;
  type: string;
  ts: string;
  path: string;
}

export function changeScalarCodecsToOurCustomTypes() {
  for (const scalar of customScalars.values()) {
    const fqName = `${scalar.module}::${scalar.type}`;

    // codes are used for edgeql files
    const id = KNOWN_TYPENAMES.get(fqName)!;
    const codec = SCALAR_CODECS.get(id)!;
    Object.assign(codec, { tsType: scalar.ts, importedType: true });

    // this is used for schema interfaces
    scalarToLiteralMapping[fqName].type = scalar.ts;
  }
}
