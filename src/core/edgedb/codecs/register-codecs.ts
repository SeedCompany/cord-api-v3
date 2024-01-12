import { delay, mapEntries } from '@seedcompany/common';
import { $, Client } from 'edgedb';
import { KNOWN_TYPENAMES } from 'edgedb/dist/codecs/consts.js';
import { ScalarCodec } from 'edgedb/dist/codecs/ifaces.js';
import { retry } from '~/common/retry';
import { ScalarCodecClass } from './type.util';

export const registerCustomScalarCodecs = async (
  client: Client,
  codecs: readonly ScalarCodecClass[],
) => {
  async function registerWithServerSchema() {
    const introspected = await $.introspect.scalars(client);
    const scalarIdsByName = mapEntries(introspected, ([_, scalar]) => [
      scalar.name,
      scalar.id.replaceAll('-', ''),
    ]).asMap;
    register(client, codecs, scalarIdsByName);
  }

  const connectedFast = await Promise.race([
    client.ensureConnected(),
    delay({ seconds: 2 }), // don't wait full 30 seconds with retries
  ]);
  // If connection was established fast, register with schema info, and wait for completion
  if (connectedFast) {
    await registerWithServerSchema();
  } else {
    // Otherwise, register statically known codecs immediately
    register(client, codecs);
    // And then keep trying to connect in the background, and register on successful connection.
    void retry(
      async () => {
        if (client.isClosed()) {
          return;
        }
        await client.ensureConnected();
        await registerWithServerSchema();
      },
      {
        forever: true,
        unref: true,
        maxTimeout: { seconds: 10 },
      },
    );
  }
};

const register = (
  client: Client,
  scalarCodecs: readonly ScalarCodecClass[],
  scalarIdsByName?: ReadonlyMap<string, string>,
) => {
  const registry = (client as any).pool._codecsRegistry;
  const codecs: Map<string, ScalarCodec> = registry.customScalarCodecs;

  for (const scalarCodec of scalarCodecs) {
    const typeName = `${scalarCodec.info.module}::${scalarCodec.info.type}`;
    const uuid =
      KNOWN_TYPENAMES.get(typeName) ?? scalarIdsByName?.get(typeName);
    if (!uuid) {
      continue;
    }
    codecs.set(uuid, new scalarCodec(uuid));
  }
};
