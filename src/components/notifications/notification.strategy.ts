import { createMetadataDecorator } from '@seedcompany/nest';
import { type Query } from 'cypher-query-builder';
import type { AbstractClass, Simplify } from 'type-fest';
import type { UnwrapSecured } from '~/common';
import type { RawChangeOf } from '~/core/database/changes';
import type { QueryFragment } from '~/core/database/query-augmentation/apply';
import { type $, e } from '~/core/gel';
import type { Notification } from './dto';

export const NotificationStrategy = createMetadataDecorator({
  types: ['class'],
  setter: (cls: AbstractClass<Notification>) => cls,
});

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
   * Should recipients be returned from the database?
   * Useful if the strategy can dynamically select a small-ish set of users
   * from specific data in the database.
   */
  returnRecipientsFromDB(): boolean {
    return false;
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
