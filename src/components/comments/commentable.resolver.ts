import { Info, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { GraphQLResolveInfo } from 'graphql';
import { ListArg, LoggedInSession, Resource, Session } from '../../common';
import { Loader, LoaderOf } from '../../core';
import { resourceFromName } from '../authorization/model/resource-map';
import { CommentThreadLoader } from './comment-thread.loader';
import { CommentService } from './comment.service';
import {
  Commentable,
  CommentThreadListInput,
  CommentThreadListOutput,
} from './dto';

@Resolver(Commentable)
export class CommentableResolver {
  constructor(private readonly service: CommentService) {}

  @ResolveField(() => CommentThreadListOutput, {
    description: 'List of comment threads belonging to the parent node.',
  })
  async commentThreads(
    @Info() info: GraphQLResolveInfo,
    @Parent() parent: Commentable & Resource,
    @ListArg(CommentThreadListInput) input: CommentThreadListInput,
    @LoggedInSession() session: Session,
    @Loader(CommentThreadLoader) commentThreads: LoaderOf<CommentThreadLoader>
  ): Promise<CommentThreadListOutput> {
    const list = await this.service.listThreads(
      resourceFromName(info.parentType.name),
      parent,
      {
        ...input,
        filter: {
          ...input.filter,
          parentId: parent.id,
        },
      },
      session
    );
    commentThreads.primeAll(list.items);
    return list;
  }
}
