import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { type ID, IdArg } from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { UserLoader } from '../user';
import { User } from '../user/dto';
import { CommentThreadLoader as ThreadLoader } from './comment-thread.loader';
import { CommentService } from './comment.service';
import {
  Comment,
  Commentable,
  CommentDeleted,
  CommentThread,
  CommentUpdated,
  UpdateComment,
} from './dto';

@Resolver(Comment)
export class CommentResolver {
  constructor(private readonly service: CommentService) {}

  @Mutation(() => CommentUpdated, {
    description: 'Update an existing comment',
  })
  async updateComment(
    @Args('input') input: UpdateComment,
  ): Promise<CommentUpdated> {
    const comment = await this.service.update(input);
    return { comment };
  }

  @Mutation(() => CommentDeleted, {
    description: 'Delete a comment',
  })
  async deleteComment(@IdArg() id: ID): Promise<CommentDeleted> {
    await this.service.delete(id);
    return { success: true };
  }

  @ResolveField(() => User)
  async creator(
    @Parent() comment: Comment,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<User> {
    return await users.load(comment.creator);
  }

  @ResolveField(() => CommentThread)
  async thread(
    @Parent() comment: Comment,
    @Loader(ThreadLoader) threads: LoaderOf<ThreadLoader>,
  ): Promise<CommentThread> {
    return await threads.load(comment.thread);
  }

  @ResolveField(() => Commentable)
  async container(
    @Parent() comment: Comment,
    @Loader(ThreadLoader) threads: LoaderOf<ThreadLoader>,
  ): Promise<Commentable> {
    const thread = await threads.load(comment.thread);
    return await this.service.loadCommentable(thread.parent);
  }
}
