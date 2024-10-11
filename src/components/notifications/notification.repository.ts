import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { omit } from 'lodash';
import { DateTime } from 'luxon';
import {
  EnhancedResource,
  ID,
  NotFoundException,
  ResourceShape,
  Session,
  UnsecuredDto,
} from '~/common';
import { CommonRepository } from '~/core/database';
import {
  apoc,
  createRelationships,
  filter,
  merge,
  paginate,
  requestingUser,
  variable,
} from '~/core/database/query';
import {
  MarkNotificationReadArgs,
  Notification,
  NotificationFilters,
  NotificationListInput,
} from './dto';
import { NotificationServiceImpl } from './notification.service';

@Injectable()
export class NotificationRepository extends CommonRepository {
  constructor(
    @Inject(forwardRef(() => NotificationServiceImpl))
    private readonly service: NotificationServiceImpl & {},
  ) {
    super();
  }

  async create(
    recipients: ReadonlyArray<ID<'User'>>,
    type: ResourceShape<any>,
    input: Record<string, any>,
    session: Session,
  ) {
    const extra = omit(input, Notification.Props);
    const createdAt = DateTime.now();
    await this.db
      .query()
      .match(requestingUser(session))
      .create([
        node('source', 'NotificationSource', {
          id: variable(apoc.create.uuid()),
          createdAt,
        }),
        relation('out', '', 'producer'),
        node('requestingUser'),
      ])
      .with('source')
      .unwind(recipients.slice(), 'userId')
      .match(node('for', 'User', { id: variable('userId') }))
      .create(
        node('node', EnhancedResource.of(type).dbLabels, {
          id: variable(apoc.create.uuid()),
          createdAt,
          unread: variable('true'),
          type: this.getType(type),
        }),
      )
      .with('*')
      .apply(this.service.getStrategy(type).saveForNeo4j(extra))
      .with('*')
      .apply(
        createRelationships(Notification, {
          in: { produced: variable('source') },
          out: { for: variable('for') },
        }),
      )
      .return('node')
      .run();
  }

  async markRead({ id, unread }: MarkNotificationReadArgs, session: Session) {
    const result = await this.db
      .query()
      .match([
        node('node', 'Notification', { id }),
        relation('out', '', 'for'),
        requestingUser(session),
      ])
      .setValues({ node: { unread } }, true)
      .with('node')
      .apply(this.hydrate())
      .first();
    if (!result) {
      throw new NotFoundException();
    }
    return result.dto;
  }

  async list(input: NotificationListInput, session: Session) {
    const result = await this.db
      .query()
      .match(requestingUser(session))
      .subQuery('requestingUser', (q) =>
        q
          .match([
            node('node', 'Notification'),
            relation('out', '', 'for'),
            node('requestingUser'),
          ])
          .apply(notificationFilters(input.filter))
          .with('node')
          .orderBy('node.createdAt', 'DESC')
          .apply(paginate(input, this.hydrate())),
      )
      .subQuery('requestingUser', (q) =>
        q
          .match([
            node('node', 'Notification', { unread: variable('true') }),
            relation('out', '', 'for'),
            node('requestingUser'),
          ])
          .return<{ totalUnread: number }>('count(node) as totalUnread'),
      )
      .return(['items', 'hasMore', 'total', 'totalUnread'])
      .first();
    return result!;
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .subQuery((q) => {
          const concreteHydrates = [...this.service.strategyMap].map(
            ([dtoCls, strategy]) =>
              (q: Query) => {
                const type = this.getType(dtoCls);
                const hydrate = strategy.hydrateExtraForNeo4j('extra');
                return q
                  .with('node')
                  .with('node')
                  .where({ 'node.type': type })
                  .apply(hydrate ?? ((q) => q.return('{} as extra')));
              },
          );
          return concreteHydrates.reduce(
            (acc: Query | undefined, concreteHydrate) =>
              (!acc ? q : acc.union()).apply(concreteHydrate),
            undefined,
          )!;
        })
        .return<{ dto: UnsecuredDto<Notification> }>(
          merge('node', 'extra', {
            __typename: 'node.type + "Notification"',
          }).as('dto'),
        );
  }

  private getType(dtoCls: ResourceShape<Notification>) {
    return dtoCls.name.replace('Notification', '');
  }
}

const notificationFilters = filter.define(() => NotificationFilters, {
  unread: ({ value }) => ({ node: { unread: value } }),
});
