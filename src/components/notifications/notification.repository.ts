import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { type Nil } from '@seedcompany/common';
import {
  inArray,
  isNull,
  node,
  not,
  type Query,
  relation,
} from 'cypher-query-builder';
import { omit } from 'lodash';
import { DateTime } from 'luxon';
import {
  EnhancedResource,
  type ID,
  NotFoundException,
  type ResourceShape,
  type UnsecuredDto,
} from '~/common';
import { CommonRepository } from '~/core/database';
import {
  apoc,
  createRelationships,
  currentUser,
  filter,
  merge,
  paginate,
  variable,
} from '~/core/database/query';
import {
  type MarkNotificationReadArgs,
  Notification,
  NotificationFilters,
  type NotificationListInput,
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
    recipients: ReadonlyArray<ID<'User'>> | Nil,
    type: ResourceShape<any>,
    input: Record<string, any>,
  ) {
    const extra = omit(input, [...EnhancedResource.of(Notification).props]);
    const strategy = this.service.getStrategy(type);
    const res = await this.db
      .query()
      .create(
        node('node', EnhancedResource.of(type).dbLabels, {
          id: variable(apoc.create.uuid()),
          createdAt: DateTime.now(),
          type: this.getType(type),
        }),
      )
      .with('node')
      .apply(strategy.saveForNeo4j(extra))
      .with('*')
      .apply(
        createRelationships(Notification, 'out', {
          creator: currentUser,
        }),
      )
      .subQuery(['node'], (sub) =>
        sub
          .apply((q) =>
            recipients == null
              ? q.subQuery(strategy.recipientsForNeo4j(input))
              : q
                  .match(node('recipient', 'User'))
                  .where({ 'recipient.id': inArray(recipients) }),
          )
          .create([
            node('node'),
            relation('out', '', 'recipient'),
            node('recipient'),
          ])
          .return<{
            totalRecipients: number;
            recipients: readonly ID[] | null;
          }>([
            'count(recipient) as totalRecipients',
            strategy.returnRecipientsFromDB()
              ? 'collect(recipient.id) as recipients'
              : 'null as recipients',
          ]),
      )
      .subQuery('node', this.hydrate())
      .return('dto, totalRecipients, recipients')
      .first();
    return res!;
  }

  async markRead({ id, unread }: MarkNotificationReadArgs) {
    const result = await this.db
      .query()
      .match([
        node('node', 'Notification', { id }),
        relation('out', 'recipient', 'recipient'),
        currentUser,
      ])
      .setValues({ 'recipient.readAt': unread ? null : DateTime.now() })
      .with('node')
      .apply(this.hydrate())
      .first();
    if (!result) {
      throw new NotFoundException();
    }
    return result.dto;
  }

  async list(input: NotificationListInput) {
    const result = await this.db
      .query()
      .match(currentUser.as('currentUser'))
      .subQuery('currentUser', (q) =>
        q
          .match([
            node('node', 'Notification'),
            relation('out', 'recipient', 'recipient'),
            node('currentUser'),
          ])
          .apply(notificationFilters(input.filter))
          .with('node')
          .orderBy('node.createdAt', 'DESC')
          .apply(paginate(input, this.hydrate())),
      )
      .subQuery('currentUser', (q) =>
        q
          .match([
            node('node', 'Notification'),
            relation('out', 'recipient', 'recipient'),
            node('currentUser'),
          ])
          .where({ 'recipient.readAt': isNull() })
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
        .optionalMatch([
          node('node'),
          relation('out', 'recipient', 'recipient'),
          currentUser,
        ])
        .return<{ dto: UnsecuredDto<Notification> }>(
          merge('node', 'extra', {
            __typename: 'node.type + "Notification"',
            unread: 'recipient.readAt is null',
            readAt: 'recipient.readAt',
          }).as('dto'),
        );
  }

  private getType(dtoCls: ResourceShape<Notification>) {
    return dtoCls.name.replace('Notification', '');
  }
}

const notificationFilters = filter.define(() => NotificationFilters, {
  unread: ({ value }) => ({
    'recipient.readAt': value ? isNull() : not(isNull()),
  }),
});
