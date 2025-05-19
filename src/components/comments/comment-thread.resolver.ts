import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { type ID, IdArg, ListArg } from '~/common';
import { Loader, type LoaderOf, ResourceLoader } from '~/core';
import { Identity } from '~/core/authentication';
import { UserLoader } from '../user';
import { User } from '../user/dto';
import { CommentThreadLoader } from './comment-thread.loader';
import { CommentLoader } from './comment.loader';
import { CommentService } from './comment.service';
import {
  Comment,
  Commentable,
  CommentList,
  CommentListInput,
  CommentThread,
  CommentThreadList,
  CommentThreadListInput,
} from './dto';

@Resolver(CommentThread)
export class CommentThreadResolver {
  constructor(
    private readonly service: CommentService,
    private readonly resources: ResourceLoader,
    private readonly identity: Identity,
  ) {}

  @Query(() => CommentThread, {
    description: 'Look up a comment thread by ID',
  })
  async commentThread(
    @IdArg() id: ID,
    @Loader(CommentThreadLoader) commentThreads: LoaderOf<CommentThreadLoader>,
  ): Promise<CommentThread> {
    return await commentThreads.load(id);
  }

  @Query(() => CommentThreadList, {
    description: 'Look up a comment threads for a resource',
  })
  async commentThreads(
    @IdArg({ name: 'resource' }) resourceId: ID,
    @ListArg(CommentThreadListInput) input: CommentThreadListInput,
    @Loader(CommentThreadLoader) commentThreads: LoaderOf<CommentThreadLoader>,
  ): Promise<CommentThreadList> {
    // TODO move to auth policy
    this.identity.verifyLoggedIn();
    const resource = await this.service.loadCommentable(resourceId);
    const list = await this.service.listThreads(resource, input);
    commentThreads.primeAll(list.items);
    return list;
  }

  @ResolveField(() => CommentList, {
    description: 'List of comments belonging to a thread',
  })
  async comments(
    @Parent() thread: CommentThread,
    @ListArg(CommentListInput) input: CommentListInput,
    @Loader(CommentLoader) comments: LoaderOf<CommentLoader>,
  ): Promise<CommentList> {
    const list = await this.service.listCommentsByThreadId(thread, input);
    comments.primeAll(list.items);
    return list;
  }

  @ResolveField(() => Comment, {
    nullable: true,
  })
  async latestComment(
    @Parent() thread: CommentThread,
    @Args('includeFirst', {
      defaultValue: false,
      description: stripIndent`
        Use the first comment when there are no others.
        This is false by default to limit data over the wire,
        and null implies that the first comment is the latest.
      `,
    })
    includeFirst: boolean,
  ) {
    return thread.firstComment.id === thread.latestComment.id && includeFirst
      ? thread.latestComment
      : null;
  }

  @ResolveField(() => Commentable)
  async parent(@Parent() thread: CommentThread) {
    return await this.resources.loadByBaseNode(thread.parent);
  }

  @ResolveField(() => Commentable)
  async container(@Parent() thread: CommentThread) {
    return await this.resources.loadByBaseNode(thread.parent);
  }

  @ResolveField(() => User)
  async creator(
    @Parent() thread: CommentThread,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ) {
    return await users.load(thread.creator);
  }
}
