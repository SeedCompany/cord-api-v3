import { node, type Query, relation } from 'cypher-query-builder';
import { type ID } from '~/common';
import { createRelationships, exp } from '~/core/neo4j/query';
import {
  INotificationStrategy,
  type InputOf,
  type NotificationRow,
  NotificationStrategy,
} from '../../notifications';
import { CommentViaMentionNotification } from './comment-via-mention-notification.dto';

@NotificationStrategy(CommentViaMentionNotification)
export class CommentViaMentionNotificationStrategy extends INotificationStrategy<CommentViaMentionNotification> {
  saveForNeo4j(input: InputOf<CommentViaMentionNotification>) {
    return (query: Query) =>
      query.apply(
        createRelationships(CommentViaMentionNotification, 'out', {
          comment: ['Comment', input.comment],
        }),
      );
  }

  hydrateExtraForNeo4j(outVar: string) {
    return (query: Query) =>
      query
        .match([
          node('node'),
          relation('out', '', 'comment'),
          node('comment', 'Comment'),
        ])
        .return(
          exp({
            comment: 'comment { .id }',
          }).as(outVar),
        );
  }

  override saveForDrizzle(input: InputOf<CommentViaMentionNotification>) {
    return { commentId: input.comment };
  }

  override hydrateExtraForDrizzle(row: NotificationRow) {
    return { comment: { id: row.commentId as ID<'Comment'> } };
  }
}
