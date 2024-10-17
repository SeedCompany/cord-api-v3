import { createMetadataDecorator } from '@seedcompany/nest';
import { Query } from 'cypher-query-builder';
import { AbstractClass, Simplify } from 'type-fest';
import type { UnwrapSecured } from '~/common';
import type { RawChangeOf } from '~/core/database/changes';
import type { QueryFragment } from '~/core/database/query-augmentation/apply';
import { $, e } from '~/core/edgedb';
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
   * Expected to return rows with a user as `recipient`
   */
  // eslint-disable-next-line @seedcompany/no-unused-vars
  recipientsForNeo4j(input: TInput) {
    // No recipients. Only those explicitly specified in the service create call.
    return (query: Query) => query.unwind([], 'recipient').return('recipient');
  }

  recipientsForEdgeDB(
    // eslint-disable-next-line @seedcompany/no-unused-vars
    input: TInput,
  ): $.Expression<$.TypeSet<typeof e.User.__element__>> {
    // No recipients. Only those explicitly specified in the service create call.
    return e.cast(e.User, e.set());
  }

  saveForNeo4j(input: TInput) {
    return (query: Query) => query.setValues({ node: input }, true);
  }

  abstract insertForEdgeDB(
    input: TInput,
  ): $.Expression<
    $.TypeSet<
      $.ObjectType<string, typeof e.Notification.__element__.__pointers__>,
      $.Cardinality.One
    >
  >;

  hydrateExtraForNeo4j(outVar: string): QueryFragment | undefined {
    const _used = outVar;
    return undefined;
  }

  abstract hydrateExtraForEdgeDB(): Record<string, any>;
}
