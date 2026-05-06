import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { MarkdownScalar } from '~/common';
import {
  ChannelAvailability,
  NotificationChannel,
  NotificationType,
} from '../dto';

@ObjectType({
  description: 'The enabled/disabled state for a single delivery channel.',
})
export class NotificationChannelPreference {
  @Field(() => NotificationChannel)
  readonly channel: NotificationChannel;

  @Field(() => ChannelAvailability, {
    description: 'The availability of this channel for this notification type',
  })
  readonly availability: ChannelAvailability;

  @Field(() => Boolean, {
    nullable: true,
    description:
      "The user's override for this channel, or null if using the default",
  })
  readonly override: boolean | null;

  @Field({
    description: 'The resolved value (override if set, otherwise default)',
  })
  readonly enabled: boolean;
}

@ObjectType({
  description:
    'The effective channel settings for a single notification type, ' +
    'reflecting defaults merged with user overrides.',
})
export class NotificationPreference {
  @Field(() => NotificationType, {
    description: 'The notification type identifier (e.g. "System")',
  })
  readonly notificationType: NotificationType;

  @Field(() => String, {
    description: 'The human-readable label for this notification type',
  })
  readonly label: string;

  @Field(() => MarkdownScalar, {
    nullable: true,
    description:
      'The markdown description providing more details on this notification type',
  })
  readonly description: string | null | undefined;

  @Field(() => [NotificationChannelPreference], {
    description: 'Per-channel preference details',
  })
  readonly channelPreferences: readonly NotificationChannelPreference[];
}

@InputType()
export class UpdateNotificationChannelOverride {
  @Field(() => NotificationChannel)
  readonly channel: NotificationChannel;

  @Field(() => Boolean, {
    nullable: true,
    description:
      'Set to true/false to override the default, or null to remove the override.',
  })
  readonly enabled?: boolean | null;
}

@InputType()
export abstract class UpdateNotificationPreference {
  @Field(() => NotificationType, {
    description: 'The notification type identifier (e.g. "System")',
  })
  readonly notificationType: NotificationType;

  @Field(() => [UpdateNotificationChannelOverride], {
    nullable: true,
    description: stripIndent`
      Per-channel overrides for notification delivery.

      Or pass as null to remove all overrides.

      Note that items should only have a channel once, and duplicates are ignored.
    `,
  })
  readonly channels: readonly UpdateNotificationChannelOverride[] | null;
}
