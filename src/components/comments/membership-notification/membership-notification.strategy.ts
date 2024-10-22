import { inArray, node, not, Query, relation } from 'cypher-query-builder';
import { ACTIVE, createRelationships, exp } from '~/core/database/query';
import { e } from '~/core/edgedb';
import {
  INotificationStrategy,
  NotificationStrategy,
} from '../../notifications';
import { CommentViaMembershipNotification } from './membership-notification.dto';

type Input = (typeof CommentViaMembershipNotification)['Input'];

@NotificationStrategy(CommentViaMembershipNotification)
export class CommentViaMembershipNotificationStrategy extends INotificationStrategy<
  CommentViaMembershipNotification,
  Input
> {
  saveForNeo4j(input: Input) {
    return (query: Query) =>
      query.apply(
        createRelationships(CommentViaMembershipNotification, 'out', {
          comment: ['Comment', input.comment],
        }),
      );
  }

  recipientsForNeo4j(input: Input) {
    return (query: Query) =>
      query
        .match([
          node('', 'Comment', { id: input.comment }),
          relation('in', undefined, 'comment'),
          node('', 'CommentThread'),
          relation('in', undefined, 'commentThread'),
          node('', 'BaseNode'), // Commentable
          relation('in', '', undefined, [0, 1]),
          node('', 'Project'),
          relation('out', '', 'member', ACTIVE),
          node('', 'ProjectMember'),
          relation('out', '', 'user', ACTIVE),
          node('recipient', 'User'),
        ])
        .where({ 'recipient.id': not(inArray(input.mentionees)) })
        .return('recipient');
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

  recipientsForEdgeDB(input: Input) {
    const comment = e.cast(e.Comments.Comment, e.uuid(input.comment));
    const mentionees = e.cast(e.uuid, e.set(...input.mentionees));
    const { container } = comment.thread;
    const project = container.is(e.Project.ContextAware).projectContext
      .projects;

    return e.select(project.members.user, (user) => ({
      filter: e.op(user.id, 'not in', mentionees),
    }));
  }
}
