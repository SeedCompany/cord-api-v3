import { node, Query, relation } from 'cypher-query-builder';
import { createRelationships, exp } from '~/core/database/query';
import { e } from '~/core/edgedb';
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
          comment: ['Comment', input.comment],
        }),
      );
  }

  insertForEdgeDB(input: InputOf<Mentioned>) {
    return e.insert(e.Notification.CommentMentioned, {
      comment: e.cast(e.Comments.Comment, e.uuid(input.comment)),
    });
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

  hydrateExtraForEdgeDB() {
    return e.is(e.Notification.CommentMentioned, {
      comment: true,
    });
  }
}
