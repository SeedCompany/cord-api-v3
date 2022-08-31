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
    @LoggedInSession() session: Session
  ): Promise<CreateCommentOutput> {
    const comment = await this.service.create(input, session);
    return { comment };
  }

  @ResolveField(() => CommentThread)
  async commentThread(
    @Parent() output: CreateCommentOutput,
    @Loader(CommentThreadLoader) threads: LoaderOf<CommentThreadLoader>
  ) {
    return await threads.load(output.comment.thread);
  }
}
