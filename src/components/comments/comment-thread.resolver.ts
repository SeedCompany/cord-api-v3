import { Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, ID, IdArg, ListArg, Session } from '~/common';
import { Loader, LoaderOf } from '~/core';
import { CommentThreadLoader } from './comment-thread.loader';
import { CommentLoader } from './comment.loader';
import { CommentService } from './comment.service';
import { CommentList, CommentListInput, CommentThread } from './dto';

@Resolver(CommentThread)
export class CommentThreadResolver {
  constructor(private readonly service: CommentService) {}

  @Query(() => CommentThread, {
    description: 'Look up a comment thread by ID',
  })
  async commentThread(
    @IdArg() id: ID,
    @Loader(CommentThreadLoader) commentThreads: LoaderOf<CommentThreadLoader>
  ): Promise<CommentThread> {
    return await commentThreads.load(id);
  }

  @ResolveField(() => CommentList, {
    description: 'List of comments belonging to a thread',
  })
  async comments(
    @AnonSession() session: Session,
    @Parent() { id }: CommentThread,
    @ListArg(CommentListInput) input: CommentListInput,
    @Loader(CommentLoader) comments: LoaderOf<CommentLoader>
  ): Promise<CommentList> {
    const list = await this.service.listCommentsByThreadId(id, input, session);
    comments.primeAll(list.items);
    return list;
  }
}
