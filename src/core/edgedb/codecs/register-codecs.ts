import { KNOWN_TYPENAMES } from 'edgedb/dist/codecs/consts.js';
import { ScalarCodec } from 'edgedb/dist/codecs/ifaces.js';
import { Client } from '../reexports';
import { ScalarCodecClass } from './type.util';

export const registerCustomScalarCodecs = (
  client: Client,
  scalarCodecs: readonly ScalarCodecClass[],
) => {
  const registry = (client as any).pool._codecsRegistry;
  const codecs: Map<string, ScalarCodec> = registry.customScalarCodecs;

  for (const scalarCodec of scalarCodecs) {
    const typeName = `${scalarCodec.info.module}::${scalarCodec.info.type}`;
    const uuid = KNOWN_TYPENAMES.get(typeName);
    if (!uuid) {
      continue;
    }
    codecs.set(uuid, new scalarCodec(uuid));
  }
};
