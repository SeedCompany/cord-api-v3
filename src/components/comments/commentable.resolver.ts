import { Info, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import {
  Fields,
  ID,
  IdArg,
  IsOnly,
  ListArg,
  LoggedInSession,
  Resource,
  Session,
} from '~/common';
import { Loader, LoaderOf } from '~/core';
import { CommentThreadLoader } from './comment-thread.loader';
import { CommentService } from './comment.service';
import { Commentable, CommentThreadList, CommentThreadListInput } from './dto';

@Resolver(Commentable)
export class CommentableResolver {
  constructor(private readonly service: CommentService) {}

  @Query(() => Commentable, {
    description: 'Load a commentable resource by ID',
  })
  async commentable(@IdArg({ name: 'resource' }) id: ID): Promise<Commentable> {
    return await this.service.loadCommentable(id);
  }

  @ResolveField(() => CommentThreadList, {
    description: 'List of comment threads belonging to the parent node.',
  })
  async commentThreads(
    @Parent() parent: Commentable & Resource,
    @ListArg(CommentThreadListInput) input: CommentThreadListInput,
    @LoggedInSession() session: Session,
    @Loader(CommentThreadLoader) commentThreads: LoaderOf<CommentThreadLoader>,
    @Info(Fields, IsOnly(['total'])) onlyTotal: boolean,
  ) {
    if (onlyTotal) {
      const total = await this.service.getThreadCount(parent, session);
      return { total };
    }
    const list = await this.service.listThreads(parent, input, session);
    commentThreads.primeAll(list.items);
    return list;
  }
}
