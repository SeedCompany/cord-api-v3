import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { ID, IdArg, LoggedInSession, Session } from '../../common';
import { SecuredUser, UserService } from '../user';
import {
  CreatePostInput,
  CreatePostOutput,
  Post,
  UpdatePostInput,
  UpdatePostOutput,
} from './dto';
import { PostService } from './post.service';

@Resolver(Post)
export class PostResolver {
  constructor(
    private readonly service: PostService,
    private readonly user: UserService
  ) {}

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
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<Post> {
    return await this.service.readOne(id, session);
  }

  @ResolveField(() => SecuredUser)
  async creator(
    @Parent() post: Post,
    @LoggedInSession() session: Session
  ): Promise<SecuredUser> {
    const { value: id, ...rest } = post.creator;
    const value = id ? await this.user.readOne(id as ID, session) : undefined;

    return {
      value,
      ...rest,
    };
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

  @Mutation(() => Boolean, {
    description: 'Delete a post',
  })
  async deletePost(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<boolean> {
    await this.service.delete(id, session);
    return true;
  }
}
