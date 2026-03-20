import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { NotificationChannel } from '../dto';
import {
  NotificationPreference,
  UpdateNotificationPreference,
} from './notification-preference.dto';
import { NotificationPreferencesService } from './notification-preferences.service';

@Resolver(NotificationPreference)
export class NotificationPreferencesResolver {
  constructor(private readonly preferences: NotificationPreferencesService) {}

  @Query(() => [NotificationPreference], {
    description: 'The effective notification preferences for the current user',
  })
  async notificationPreferences(): Promise<readonly NotificationPreference[]> {
    return await this.preferences.getPreferences();
  }

  @ResolveField(() => [NotificationChannel], {
    description: 'Convenience list of channels that are currently enabled',
  })
  channels(
    @Parent() preference: NotificationPreference,
  ): readonly NotificationChannel[] {
    return preference.channelPreferences.flatMap((p) =>
      p.enabled ? p.channel : [],
    );
  }

  @Mutation(() => [NotificationPreference], {
    description: stripIndent`
      Update the current user's notification preferences for specific types

      Note that items should only have a notificationType once, and duplicates are ignored.
    `,
  })
  async updateNotificationPreferences(
    @Args('input', { type: () => [UpdateNotificationPreference] })
    input: readonly UpdateNotificationPreference[],
  ): Promise<readonly NotificationPreference[]> {
    await this.preferences.updatePreferences(input);
    return await this.preferences.getPreferences();
  }
}
