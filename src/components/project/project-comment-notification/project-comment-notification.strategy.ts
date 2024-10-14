import { node, Query, relation } from 'cypher-query-builder';
import { createRelationships } from '~/core/database/query';
import {
  INotificationStrategy,
  InputOf,
  NotificationStrategy,
} from '../../notifications';
import { ProjectCommentNotification as ProjectComment } from './project-comment-notification.dto';

@NotificationStrategy(ProjectComment)
export class ProjectCommentNotificationStrategy extends INotificationStrategy<ProjectComment> {
  saveForNeo4j(input: InputOf<ProjectComment>) {
    return (query: Query) =>
      query.apply(
        createRelationships(ProjectComment, 'out', {
          project: ['Project', input.project],
          comment: ['Comment', input.comment],
        }),
      );
  }

  hydrateExtraForNeo4j() {
    return (query: Query) =>
      query
        .optionalMatch([
          node('node'),
          relation('out', '', 'project'),
          node('project', 'Project'),
        ])
        .optionalMatch([
          node('node'),
          relation('out', '', 'comment'),
          node('comment', 'Comment'),
        ]);
  }
}
