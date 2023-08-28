import { Info, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { GraphQLResolveInfo } from 'graphql';
import { ListArg, LoggedInSession, Resource, Session } from '~/common';
import { Loader, LoaderOf } from '~/core';
import { Postable } from './dto';
import { PostListInput, SecuredPostList } from './dto/list-posts.dto';
import { PostLoader } from './post.loader';
import { PostService } from './post.service';

@Resolver(Postable)
export class PostableResolver {
  constructor(private readonly service: PostService) {}

  @ResolveField(() => SecuredPostList, {
    description: 'List of posts belonging to the parent node.',
  })
  async posts(
    @Info() info: GraphQLResolveInfo,
    @Parent() parent: Postable & Resource,
    @ListArg(PostListInput) input: PostListInput,
    @LoggedInSession() session: Session,
    @Loader(PostLoader) posts: LoaderOf<PostLoader>,
  ): Promise<SecuredPostList> {
    const list = await this.service.securedList(
      {
        ...parent,
        __typename: info.parentType.name,
      },
      {
        ...input,
        filter: {
          ...input.filter,
          parentId: parent.id,
        },
      },
      session,
    );
    posts.primeAll(list.items);
    return list;
  }
}
