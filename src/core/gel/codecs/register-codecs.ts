import { delay, mapEntries } from '@seedcompany/common';
import { $, Client } from 'gel';
import { INVALID_CODEC } from 'gel/dist/codecs/codecs.js';
import { KNOWN_TYPENAMES } from 'gel/dist/codecs/consts.js';
import type Event from 'gel/dist/primitives/event.js';
import LRU from 'gel/dist/primitives/lru.js';
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
    invalidateSessionCodecs(client);
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

  // Clear registry to evict stale codecs
  // Client will rebuild as needed
  clearLRU(registry.codecs);
  clearLRU(registry.codecsBuildCache);

  const codecs: LRU<string, InstanceType<ScalarCodecClass>> = registry.codecs;
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

/**
 * Invalidate possibly stale codecs for Gel's Session
 * This causes the driver to re-evaluate (once per pre-existing connection)
 * the codec for the Session based on our updated codec registry.
 */
function invalidateSessionCodecs(client: Client) {
  for (const holder of (client as any).pool._holders) {
    if (!holder._connection) {
      continue;
    }
    const resetSessionCodec = () => {
      holder._connection.stateCodec = INVALID_CODEC;
    };
    const inUse = holder._inUse as Event | null;
    inUse ? void inUse.wait().then(resetSessionCodec) : resetSessionCodec();
  }
}

const clearLRU = (lru: LRU<any, any>) => {
  (lru as any).map.clear();
  Object.assign((lru as any).deque, {
    head: null,
    tail: null,
    len: 0,
  });
};
