import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { LoggedInSession, Session } from '../../../common';
import { PostListInput, SecuredPostList } from '../dto/list-posts.dto';
import { PostService } from '../post.service';
import { Postable } from './dto/postable.dto';

@Resolver(Postable)
export class PostableResolver {
  constructor(private readonly service: PostService) {}

  @ResolveField(() => SecuredPostList, {
    description: 'List of posts belonging to the parent node.',
  })
  async posts(
    @Parent() object: Postable,
    @Args({
      name: 'input',
      type: () => PostListInput,
      defaultValue: PostListInput.defaultVal,
    })
    input: PostListInput,
    @LoggedInSession() session: Session
  ): Promise<SecuredPostList> {
    return this.service.securedList(
      {
        ...input,
        filter: {
          ...input.filter,
          parentId: object.id,
        },
      },
      session
    );
  }
}
