import { node, Query, relation } from 'cypher-query-builder';
import { createRelationships, exp } from '~/core/database/query';
import {
  INotificationStrategy,
  InputOf,
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
}
