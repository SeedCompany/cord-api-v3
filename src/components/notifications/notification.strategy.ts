import { createMetadataDecorator } from '@seedcompany/nest';
import { type Query } from 'cypher-query-builder';
import type { AbstractClass, Simplify } from 'type-fest';
import type { UnwrapSecured } from '~/common';
import type { RawChangeOf } from '~/core/database/changes';
import { type $, e } from '~/core/gel';
import type { QueryFragment } from '~/core/neo4j/query-augmentation/apply';
import type {
  ChannelAvailability,
  Notification,
  NotificationChannel,
} from './dto';
import {
  type NotificationType,
  NotificationTypeEntries,
} from './dto/notification-type.enum';

export const NotificationStrategy = createMetadataDecorator({
  types: ['class'],
  setter: (cls: AbstractClass<Notification>) => {
    const type = cls.name.replace('Notification', '') as NotificationType;
    NotificationTypeEntries.set(type, cls);
    return { typeName: type, cls };
  },
});

/**
 * A map of channel → enabled for a notification type.
 */
export type ChannelSettings = Readonly<Record<NotificationChannel, boolean>>;
export type ChannelAvailabilities = Readonly<
  Record<NotificationChannel, ChannelAvailability>
>;

export type InputOf<T extends Notification> = Simplify<{
  [K in keyof T as Exclude<K, keyof Notification>]:
    | RawChangeOf<UnwrapSecured<T[K]> & {}>
    | (null extends UnwrapSecured<T[K]> ? null : never);
}>;

export abstract class INotificationStrategy<
  TNotification extends Notification,
  TInput = InputOf<TNotification>,
> {
  /**
   * Whether each channel is always on/off,
   * or if it is user-configurable and defaulted on/off.
   * Each strategy can define this uniquely.
   */
  channelAvailabilities(): ChannelAvailabilities {
    return {
      App: 'DefaultOn',
    };
  }

  /**
   * Should recipients be returned from the database?
   * Useful if the strategy can dynamically select a small-ish set of users
   * from specific data in the database.
   */
  returnRecipientsFromDB(): boolean {
    return false;
  }

  /**
   * If no recipients are attempted from app code or db {@link returnRecipientsFromDB},
   * then this can be used to specify specific, static broadcast channels.
   */
  broadcastTo(): readonly string[] {
    return [];
  }

  /**
   * Expected to return rows with a user as `recipient`
   */
  // eslint-disable-next-line @seedcompany/no-unused-vars
  recipientsForNeo4j(input: TInput) {
    // No recipients. Only those explicitly specified in the service create call.
    return (query: Query) => query.unwind([], 'recipient').return('recipient');
  }

  recipientsForGel(
    // eslint-disable-next-line @seedcompany/no-unused-vars
    input: TInput,
  ): $.Expression<$.TypeSet<typeof e.User.__element__>> {
    // No recipients. Only those explicitly specified in the service create call.
    return e.cast(e.User, e.set());
  }

  saveForNeo4j(input: TInput) {
    return (query: Query) => query.setValues({ node: input }, true);
  }

  hydrateExtraForNeo4j(outVar: string): QueryFragment | undefined {
    const _used = outVar;
    return undefined;
  }
}

/* eslint-disable @typescript-eslint/method-signature-style */
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface INotificationStrategy<
  TNotification extends Notification,
  TInput = InputOf<TNotification>,
> {
  insertForGel?(
    input: TInput,
  ): $.Expression<
    $.TypeSet<
      $.ObjectType<string, typeof e.Notification.__element__.__pointers__>,
      $.Cardinality.One
    >
  >;

  hydrateExtraForGel?(): Record<string, any>;
}
