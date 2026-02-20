import { Injectable } from '@nestjs/common';
import type { ID, PublicOf } from '~/common';
import { castToEnum, CommonRepository, e } from '~/core/gel';
import { type NotificationChannel, type NotificationType } from '../dto';
import type {
  NotificationPreferencesRepository as Neo4jRepository,
  PreferenceOverrideRow,
  SaveOverrideItem,
} from './notification-preferences.repository';

@Injectable()
export class NotificationPreferencesRepository
  extends CommonRepository
  implements PublicOf<Neo4jRepository>
{
  /**
   * Fetch overrides for a specific set of users.
   */
  async getOverridesForUsers(
    userIds: ReadonlyArray<ID<'User'>>,
  ): Promise<readonly PreferenceOverrideRow[]> {
    return await this.db.run(this.getOverridesForUsersQuery, {
      userIds,
    });
  }
  private readonly getOverridesForUsersQuery = e.params(
    { userIds: e.array(e.uuid) },
    ({ userIds }) => {
      const users = e.cast(e.User, e.array_unpack(userIds));
      return e.select(e.Notification.Preference, (pref) => ({
        filter: e.op(pref.user, 'in', users),
        user: true,
        notificationType: castToEnum<
          typeof pref.notificationType,
          NotificationType
        >(pref.notificationType, '' as NotificationType),
        channel: castToEnum<typeof pref.channel, NotificationChannel>(
          pref.channel,
          undefined as unknown as NotificationChannel,
        ),
        enabled: true,
      }));
    },
  );

  /**
   * Save all preference overrides for a user in a single query.
   * Items with `enabled: true/false` are upserted; items with `enabled: null`
   * have their override removed (reverted to default).
   */
  async saveOverrides(userId: ID<'User'>, items: readonly SaveOverrideItem[]) {
    await this.db.run(
      `
      with
        user := (select User filter .id = <uuid>$userId),
        items := json_array_unpack(<json>$items),
        upserts := (
          for item in items union (
            (insert Notification::Preference {
              user := user,
              notificationType := <str>item['notificationType'],
              channel := <str>item['channel'],
              enabled := <bool>item['enabled'],
            }
            unless conflict on (.user, .notificationType, .channel)
            else (
              update Notification::Preference
              set { enabled := <bool>item['enabled'] }
            )) if json_typeof(item['enabled']) != 'null' else <Notification::Preference>{}
          )
        ),
        deletes := (
          for item in items union (
            (delete Notification::Preference
            filter
              .user = user
              and .notificationType = <str>item['notificationType']
              and .channel = <str>item['channel']
            ) if json_typeof(item['enabled']) = 'null' else <Notification::Preference>{}
          )
        )
      select { upserts, deletes }
      `,
      { userId, items },
    );
  }
}
