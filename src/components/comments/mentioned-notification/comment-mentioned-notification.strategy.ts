import { node, Query, relation } from 'cypher-query-builder';
import { createRelationships, exp } from '~/core/database/query';
import {
  INotificationStrategy,
  InputOf,
  NotificationStrategy,
} from '../../notifications';
import { CommentMentionedNotification as Mentioned } from './comment-mentioned-notification.dto';

@NotificationStrategy(Mentioned)
export class CommentMentionedNotificationStrategy extends INotificationStrategy<Mentioned> {
  saveForNeo4j(input: InputOf<Mentioned>) {
    return (query: Query) =>
      query.apply(
        createRelationships(Mentioned, 'out', {
          comment: ['User', input.comment],
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
          relation('in', '', 'comment'),
          node('', 'CommentThread'),
          relation('in', '', 'commentThread'),
          node('commentable', 'BaseNode'),
        ])
        .return(
          exp({
            comment: 'comment { .id }',
            commentable: 'commentable { .id }',
          }).as(outVar),
        );
  }
}
