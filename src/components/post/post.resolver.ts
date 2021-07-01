import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  ID,
  IdArg,
  LoggedInSession,
  mapSecuredValue,
  Session,
} from '../../common';
import { Loader, LoaderOf } from '../../core';
import { PostLoader, PostService } from '../post';
import { SecuredUser, UserLoader } from '../user';
import {
  CreatePostInput,
  CreatePostOutput,
  DeletePostOutput,
  Post,
  UpdatePostInput,
  UpdatePostOutput,
} from './dto';

@Resolver(Post)
export class PostResolver {
  constructor(private readonly service: PostService) {}

  @Mutation(() => CreatePostOutput, {
    description: 'Create a discussion post',
  })
  async createPost(
    @LoggedInSession() session: Session,
    @Args('input') { post: input }: CreatePostInput
  ): Promise<CreatePostOutput> {
    const post = await this.service.create(input, session);
    return { post };
  }

  @Query(() => Post, {
    description: 'Look up a post by ID',
  })
  async post(
    @IdArg() id: ID,
    @Loader(PostLoader) posts: LoaderOf<PostLoader>
  ): Promise<Post> {
    return await posts.load(id);
  }

  @ResolveField(() => SecuredUser)
  async creator(
    @Parent() post: Post,
    @Loader(UserLoader) users: LoaderOf<UserLoader>
  ): Promise<SecuredUser> {
    return await mapSecuredValue(post.creator, (id) => users.load(id));
  }

  @Mutation(() => UpdatePostOutput, {
    description: 'Update an existing Post',
  })
  async updatePost(
    @LoggedInSession() session: Session,
    @Args('input') { post: input }: UpdatePostInput
  ): Promise<UpdatePostOutput> {
    const post = await this.service.update(input, session);
    return { post };
  }

  @Mutation(() => DeletePostOutput, {
    description: 'Delete a post',
  })
  async deletePost(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<DeletePostOutput> {
    await this.service.delete(id, session);
    return { success: true };
  }
}
