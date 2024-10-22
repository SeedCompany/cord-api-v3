import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Nil } from '@seedcompany/common';
import {
  inArray,
  isNull,
  node,
  not,
  Query,
  relation,
} from 'cypher-query-builder';
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
    recipients: ReadonlyArray<ID<'User'>> | Nil,
    type: ResourceShape<any>,
    input: Record<string, any>,
    session: Session,
  ) {
    // eslint-disable-next-line no-console
    console.log('input', input);
    const extra = omit(input, Notification.Props);
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
      .apply(this.service.getStrategy(type).saveForNeo4j(extra))
      .with('*')
      .match(requestingUser(session))
      .apply(
        createRelationships(Notification, 'out', {
          creator: variable('requestingUser'),
        }),
      )
      .subQuery(['node', 'requestingUser'], (sub) =>
        sub
          .apply((q) =>
            recipients == null
              ? q.subQuery(
                  this.service.getStrategy(type).recipientsForNeo4j(input),
                )
              : q
                  .match(node('recipient', 'User'))
                  .where({ 'recipient.id': inArray(recipients) }),
          )
          .create([
            node('node'),
            relation('out', '', 'recipient'),
            node('recipient'),
          ])
          .return<{ totalRecipients: number }>(
            'count(recipient) as totalRecipients',
          ),
      )
      .subQuery('node', this.hydrate(session))
      .return('dto, totalRecipients')
      .first();
    return res!;
  }

  async markRead({ id, unread }: MarkNotificationReadArgs, session: Session) {
    const result = await this.db
      .query()
      .match([
        node('node', 'Notification', { id }),
        relation('out', 'recipient', 'recipient'),
        requestingUser(session),
      ])
      .setValues({ 'recipient.readAt': unread ? null : DateTime.now() })
      .with('node')
      .apply(this.hydrate(session))
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
            relation('out', 'recipient', 'recipient'),
            node('requestingUser'),
          ])
          .apply(notificationFilters(input.filter))
          .with('node')
          .orderBy('node.createdAt', 'DESC')
          .apply(paginate(input, this.hydrate(session))),
      )
      .subQuery('requestingUser', (q) =>
        q
          .match([
            node('node', 'Notification'),
            relation('out', 'recipient', 'recipient'),
            node('requestingUser'),
          ])
          .where({ 'recipient.readAt': isNull() })
          .return<{ totalUnread: number }>('count(node) as totalUnread'),
      )
      .return(['items', 'hasMore', 'total', 'totalUnread'])
      .first();
    return result!;
  }

  protected hydrate(session: Session) {
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
          requestingUser(session),
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
