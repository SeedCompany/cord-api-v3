import { createMetadataDecorator } from '@seedcompany/nest';
import { type Query } from 'cypher-query-builder';
import type { AbstractClass, Simplify } from 'type-fest';
import type { ID, UnwrapSecured } from '~/common';
import type { RawChangeOf } from '~/core/database/changes';
import type { DrizzleDb, notifications } from '~/core/drizzle';
import { type $, e } from '~/core/gel';
import type { QueryFragment } from '~/core/neo4j/query-augmentation/apply';
import type { Notification } from './dto';

/** A row from the single-table-inheritance `notifications` table. */
export type NotificationRow = typeof notifications.$inferSelect;

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

  // ── Drizzle / PostgreSQL ──────────────────────────────────────────────
  // Mirror of the Neo4j/Gel hooks above for the single-table-inheritance
  // notifications table. migration-todo: at Phase 7 cutover, drop the
  // *ForNeo4j / *ForGel variants and keep only these.

  /**
   * Map this subtype's extra input fields to columns on the `notifications`
   * row. Default assumes input keys already match column names.
   */
  saveForDrizzle(input: TInput): Record<string, unknown> {
    return { ...(input as Record<string, unknown>) };
  }

  /**
   * Shape this subtype's extra fields back out of a stored notification row.
   */
  // eslint-disable-next-line @seedcompany/no-unused-vars
  hydrateExtraForDrizzle(row: NotificationRow): Record<string, unknown> {
    return {};
  }

  /**
   * Dynamic recipients selected from the DB. Mirrors {@link recipientsForNeo4j}
   * / {@link recipientsForGel}; only consulted when the service passes no
   * explicit recipient list.
   */
  async recipientsForDrizzle(
    // eslint-disable-next-line @seedcompany/no-unused-vars
    input: TInput,
    // eslint-disable-next-line @seedcompany/no-unused-vars
    db: DrizzleDb,
  ): Promise<ReadonlyArray<ID<'User'>>> {
    return [];
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
