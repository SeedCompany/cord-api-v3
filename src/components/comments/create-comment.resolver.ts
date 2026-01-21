import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Loader, type LoaderOf } from '~/core';
import { CommentThreadLoader } from './comment-thread.loader';
import { CommentService } from './comment.service';
import { CommentCreated, CommentThread, CreateComment } from './dto';

@Resolver(CommentCreated)
export class CreateCommentResolver {
  constructor(private readonly service: CommentService) {}

  @Mutation(() => CommentCreated, {
    description: 'Create a comment',
  })
  async createComment(
    @Args('input') input: CreateComment,
  ): Promise<CommentCreated> {
    const comment = await this.service.create(input);
    return { comment };
  }

  @ResolveField(() => CommentThread)
  async commentThread(
    @Parent() output: CommentCreated,
    @Loader(CommentThreadLoader) threads: LoaderOf<CommentThreadLoader>,
  ) {
    return await threads.load(output.comment.thread);
  }
}
