import { and, eq, inArray, notExists } from 'drizzle-orm';
import { type DrizzleDb } from '~/core/drizzle/drizzle.service';
import {
  broadcastChannels,
  webhookChannelObservations,
} from '~/core/drizzle/schema';

/**
 * Delete any of the given channels that no webhook observes anymore.
 * Shared between the webhooks repo (deleting a webhook drops its
 * observations) and the channel repo (re-saving a webhook's channel list can
 * drop some) — both need this same cleanup after removing observations,
 * mirroring the Neo4j repos' own duplicated "cascade to orphaned channels"
 * subqueries.
 */
export const cleanupOrphanedChannels = async (
  db: DrizzleDb,
  names: readonly string[],
) => {
  if (names.length === 0) return;
  await db
    .delete(broadcastChannels)
    .where(
      and(
        inArray(broadcastChannels.name, [...names]),
        notExists(
          db
            .select()
            .from(webhookChannelObservations)
            .where(
              eq(
                webhookChannelObservations.channelName,
                broadcastChannels.name,
              ),
            ),
        ),
      ),
    );
};
