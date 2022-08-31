import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { LoggedInSession, Session } from '~/common';
import { Loader, LoaderOf } from '~/core';
import { CommentThreadLoader } from './comment-thread.loader';
import { CommentService } from './comment.service';
import { CommentThread, CreateCommentInput, CreateCommentOutput } from './dto';

@Resolver(CreateCommentOutput)
export class CreateCommentResolver {
  constructor(private readonly service: CommentService) {}

  @Mutation(() => CreateCommentOutput, {
    description: 'Create a comment',
  })
  async createComment(
    @Args('input') input: CreateCommentInput,
    @LoggedInSession() session: Session,
    @Loader(CommentThreadLoader) threads: LoaderOf<CommentThreadLoader>
  ): Promise<CreateCommentOutput> {
    if (!input.threadId) {
      const commentThread = await this.service.createThread(
        { parentId: input.resourceId },
        session
      );
      threads.prime(commentThread.id, commentThread);

      const comment = await this.service.create(
        { ...input, threadId: commentThread.id },
        session
      );

      return { comment, commentThread: commentThread.id };
    }

    const comment = await this.service.create(input, session);
    return { comment, commentThread: input.threadId };
  }

  @ResolveField(() => CommentThread)
  async commentThread(
    @Parent() output: CreateCommentOutput,
    @Loader(CommentThreadLoader) threads: LoaderOf<CommentThreadLoader>
  ) {
    return await threads.load(output.commentThread);
  }
}
