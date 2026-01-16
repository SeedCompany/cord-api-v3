import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { type ID, IdArg, mapSecuredValue } from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { PostLoader, PostService } from '../post';
import { UserLoader } from '../user';
import { SecuredUser } from '../user/dto';
import {
  CreatePost,
  CreatePostOutput,
  DeletePostOutput,
  Post,
  UpdatePost,
  UpdatePostOutput,
} from './dto';

@Resolver(Post)
export class PostResolver {
  constructor(private readonly service: PostService) {}

  @Mutation(() => CreatePostOutput, {
    description: 'Create a discussion post',
  })
  async createPost(
    @Args('input') input: CreatePost,
  ): Promise<CreatePostOutput> {
    const post = await this.service.create(input);
    return { post };
  }

  @Query(() => Post, {
    description: 'Look up a post by ID',
  })
  async post(
    @IdArg() id: ID,
    @Loader(PostLoader) posts: LoaderOf<PostLoader>,
  ): Promise<Post> {
    return await posts.load(id);
  }

  @ResolveField(() => SecuredUser)
  async creator(
    @Parent() post: Post,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<SecuredUser> {
    return await mapSecuredValue(post.creator, ({ id }) => users.load(id));
  }

  @Mutation(() => UpdatePostOutput, {
    description: 'Update an existing Post',
  })
  async updatePost(
    @Args('input') input: UpdatePost,
  ): Promise<UpdatePostOutput> {
    const post = await this.service.update(input);
    return { post };
  }

  @Mutation(() => DeletePostOutput, {
    description: 'Delete a post',
  })
  async deletePost(@IdArg() id: ID): Promise<DeletePostOutput> {
    await this.service.delete(id);
    return { success: true };
  }
}
