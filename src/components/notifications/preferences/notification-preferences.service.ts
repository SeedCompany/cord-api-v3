import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { groupToMapBy, mapEntries, mapValues } from '@seedcompany/common';
import { uniqBy } from 'lodash';
import type { ID } from '~/common';
import { Identity } from '~/core/authentication';
import {
  ChannelAvailability,
  NotificationChannel,
  type NotificationType,
} from '../dto';
import { NotificationService } from '../notification.service';
import {
  type ChannelAvailabilities,
  type ChannelSettings,
} from '../notification.strategy';
import {
  type NotificationChannelPreference,
  type NotificationPreference,
  type UpdateNotificationPreference,
} from './notification-preference.dto';
import type { PreferenceOverrideRow } from './notification-preferences.repository';
import { NotificationPreferencesRepository } from './notification-preferences.repository';

@Injectable()
export class NotificationPreferencesService {
  constructor(
    private readonly identity: Identity,
    private readonly repo: NotificationPreferencesRepository,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService & {},
  ) {}

  /**
   * Returns the effective preferences for a user across all notification types.
   * Merges app-code defaults with any user overrides from the DB.
   */
  async getPreferences(): Promise<readonly NotificationPreference[]> {
    const overrideRows = await this.repo.getOverridesForUsers([
      this.identity.current.userId,
    ]);
    const overridesByType = this.groupOverridesByType(overrideRows);
    return [...this.notificationService.strategiesByNameType].map(
      ([typeName, strategy]) =>
        this.buildPreference(
          typeName,
          strategy.defaultChannels(),
          overridesByType.get(typeName),
        ),
    );
  }

  /**
   * Update individual channel overrides for each notification types.
   * Each entry can set an override (true/false) or remove it (null/undefined).
   */
  async updatePreferences(input: readonly UpdateNotificationPreference[]) {
    const normalized = uniqBy(input, (i) => i.notificationType).map(
      ({ notificationType, channels }) => ({
        notificationType,
        channels: channels
          ? uniqBy(channels, (c) => c.channel).map(({ channel, enabled }) => ({
              channel,
              enabled: enabled ?? null,
            }))
          : [...NotificationChannel].map((channel) => ({
              channel,
              enabled: null,
            })),
      }),
    );
    const flattened = normalized.flatMap(({ notificationType, channels }) =>
      channels.map((ch) => ({ notificationType, ...ch })),
    );
    await this.repo.saveOverrides(this.identity.current.userId, flattened);
  }

  /**
   * Get the saved override settings for this notification and these users.
   */
  async getOverridesMap(
    notificationType: NotificationType,
    userIds: ReadonlyArray<ID<'User'>>,
  ): Promise<ReadonlyMap<ID<'User'>, Partial<ChannelSettings>>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.repo.getOverridesForUsers(
      userIds,
      notificationType,
    );
    return mapValues(
      groupToMapBy(rows, (row) => row.user.id),
      (_, rows) => this.groupOverridesByType(rows).get(notificationType) ?? {},
    ).asMap;
  }

  private buildPreference(
    notificationType: NotificationType,
    defaults: ChannelSettings,
    overrides: Partial<ChannelSettings> | undefined,
  ): NotificationPreference {
    return {
      notificationType,
      channelPreferences: [...NotificationChannel].map(
        (channel): NotificationChannelPreference => ({
          channel,
          default: defaults[channel],
          override: overrides?.[channel] ?? null,
          enabled: overrides?.[channel] ?? defaults[channel],
        }),
      ),
    };
  }

  private groupOverridesByType(overrides: readonly PreferenceOverrideRow[]) {
    return mapValues(
      groupToMapBy(overrides, (override) => override.notificationType),
      (_, notificationOverrides): Partial<ChannelSettings> =>
        mapEntries(notificationOverrides, (override) => [
          override.channel,
          override.enabled,
        ]).asRecord,
    ).asMap;
  }
}
