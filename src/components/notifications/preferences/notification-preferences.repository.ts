import { Injectable } from '@nestjs/common';
import { inArray, node, relation } from 'cypher-query-builder';
import type { ID } from '~/common';
import { CommonRepository } from '~/core/neo4j';
import { apoc, variable } from '~/core/neo4j/query';
import { type LinkTo } from '~/core/resources';
import { type NotificationChannel, type NotificationType } from '../dto';

export interface PreferenceOverrideRow {
  user: LinkTo<'User'>;
  notificationType: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
}

export interface SaveOverrideItem {
  notificationType: NotificationType;
  channel: NotificationChannel;
  enabled: boolean | null;
}

@Injectable()
export class NotificationPreferencesRepository extends CommonRepository {
  /**
   * Fetch overrides for a specific set of users.
   */
  async getOverridesForUsers(
    userIds: ReadonlyArray<ID<'User'>>,
    notificationType?: NotificationType,
  ) {
    const result = await this.db
      .query()
      .match([
        node('user', 'User'),
        relation('out', '', 'user'),
        node('pref', 'NotificationPreference'),
      ])
      .where({
        'user.id': inArray(userIds),
        ...(notificationType && { 'pref.notificationType': notificationType }),
      })
      .return<PreferenceOverrideRow>([
        apoc.map.merge('pref', {
          user: 'user { .id }',
        }),
      ])
      .run();
    return result;
  }

  /**
   * Save all preference overrides for the current user in a single query.
   * Items with `enabled: true/false` are upserted; items with `enabled: null`
   * have their override removed (reverted to default).
   */
  async saveOverrides(userId: ID<'User'>, items: readonly SaveOverrideItem[]) {
    await this.db
      .query()
      .match(node('user', 'User', { id: userId }))
      .unwind([...items], 'item')
      .subQuery(['user', 'item'], (sub) =>
        sub
          .raw('WITH user, item WHERE item.enabled IS NOT NULL')
          .merge([
            node('user'),
            relation('out', '', 'user'),
            node('pref', 'NotificationPreference', {
              notificationType: variable('item.notificationType'),
              channel: variable('item.channel'),
            }),
          ])
          .setValues({ 'pref.enabled': variable('item.enabled') })
          .return('count(pref) as upserted'),
      )
      .subQuery(['user', 'item'], (sub) =>
        sub
          .raw('WITH user, item WHERE item.enabled IS NULL')
          .raw(
            `OPTIONAL MATCH (user)-[:user]->(pref:NotificationPreference {
              notificationType: item.notificationType,
              channel: item.channel
            })`,
          )
          .raw('DETACH DELETE pref')
          .return('count(*) as removed'),
      )
      .return('count(*) as total')
      .run();
  }
}
