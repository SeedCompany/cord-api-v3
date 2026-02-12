import { Info, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import {
  Fields,
  type ID,
  IdArg,
  IsOnly,
  ListArg,
  type Resource,
  SecuredList,
} from '~/common';
import { Identity } from '~/core/authentication';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { CommentThreadLoader } from './comment-thread.loader';
import { CommentService } from './comment.service';
import { Commentable, CommentThreadList, CommentThreadListInput } from './dto';

@Resolver(Commentable)
export class CommentableResolver {
  constructor(
    private readonly service: CommentService,
    private readonly identity: Identity,
  ) {}

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
    @Loader(CommentThreadLoader) commentThreads: LoaderOf<CommentThreadLoader>,
    @Info(Fields, IsOnly(['total'])) onlyTotal: boolean,
  ) {
    // TODO move to auth policy
    if (this.identity.isAnonymous) {
      return { parent, ...SecuredList.Redacted };
    }
    if (onlyTotal) {
      const total = await this.service.getThreadCount(parent);
      return { total };
    }
    const list = await this.service.listThreads(parent, input);
    commentThreads.primeAll(list.items);
    return list;
  }
}
