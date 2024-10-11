import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
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

@Injectable()
export class NotificationRepository extends CommonRepository {
  async create(
    recipients: ReadonlyArray<ID<'User'>>,
    type: ResourceShape<Notification>,
    input: unknown,
    session: Session,
  ) {
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
      query.return<{ dto: UnsecuredDto<Notification> }>(
        merge('node', {
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
