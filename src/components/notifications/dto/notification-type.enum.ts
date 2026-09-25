import { registerEnumType } from '@nestjs/graphql';
import type { MadeEnum } from '@seedcompany/nest';
import type { AbstractClass } from 'type-fest';
import { type EnumType, lazyRef, makeEnum } from '~/common';
import { type Notification } from './notification.dto';

/**
 * Type declaration for concrete notifications, their type string to their class ref.
 * i.e. `Foo: typeof FooNotification`
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface NotificationMap {
  // Use interface merging to add to this interface in the owning module.
}

/** @internal */
export const NotificationTypeEntries = new Map<
  keyof NotificationMap,
  AbstractClass<Notification>
>();

export type NotificationType = EnumType<typeof NotificationType>;
export const NotificationType = lazyRef(
  (): MadeEnum<keyof NotificationMap> =>
    (realNotificationType ??= makeEnum({
      values: NotificationTypeEntries.keys(),
    })),
);
let realNotificationType: MadeEnum<keyof NotificationMap> | undefined;
// Register proxy eagerly to GQL schema
registerEnumType(NotificationType, { name: 'NotificationType' });
