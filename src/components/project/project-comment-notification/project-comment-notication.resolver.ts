import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { ID } from '~/common';
import {
  CreateProjectCommentNotificationInput,
  CreateProjectCommentNotificationOutput,
} from './create-project-comment-notification.dto';
import { ProjectCommentNotification as ProjectComment } from './project-comment-notification.dto';
import { ProjectCommentNotificationService } from './project-comment-notification.service';

@Resolver(ProjectComment)
export class ProjectCommentNotificationResolver {
  constructor(
    private readonly projectCommentNotificationService: ProjectCommentNotificationService,
  ) {}

  @Mutation(() => CreateProjectCommentNotificationOutput, {
    description: 'Create a notification from a project comment.',
  })
  async createProjectCommentNotification(
    @Args('input') input: CreateProjectCommentNotificationInput,
    // @LoggedInSession() session: Session,
  ) {
    // @ts-expect-error this is just for testing
    const members = await this.notifications.repo.db
      .query<{ id: ID }>('match (u:User) return u.id as id')
      .map('id')
      .run();

    await this.projectCommentNotificationService.notify(
      members,
      input.commentId,
      input.projectId,
    );
  }
}
