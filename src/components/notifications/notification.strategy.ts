import { createMetadataDecorator } from '@seedcompany/nest';
import { Query } from 'cypher-query-builder';
import { AbstractClass, Simplify } from 'type-fest';
import type { UnwrapSecured } from '~/common';
import type { RawChangeOf } from '~/core/database/changes';
import type { QueryFragment } from '~/core/database/query-augmentation/apply';
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
  saveForNeo4j(input: TInput) {
    return (query: Query) => query.setValues({ node: input }, true);
  }

  hydrateExtraForNeo4j(outVar: string): QueryFragment | undefined {
    const _used = outVar;
    return undefined;
  }
}
