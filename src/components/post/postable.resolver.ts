import { Args, Info, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { GraphQLResolveInfo } from 'graphql';
import { LoggedInSession, Resource, Session } from '../../common';
import { resourceFromName } from '../authorization/model/resource-map';
import { Postable } from './dto';
import { PostListInput, SecuredPostList } from './dto/list-posts.dto';
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
    @Args({
      name: 'input',
      type: () => PostListInput,
      defaultValue: PostListInput.defaultVal,
    })
    input: PostListInput,
    @LoggedInSession() session: Session
  ): Promise<SecuredPostList> {
    return await this.service.securedList(
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
  }
}
