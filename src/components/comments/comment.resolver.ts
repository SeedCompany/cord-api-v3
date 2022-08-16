import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  AnonSession,
  ID,
  IdArg,
  ListArg,
  LoggedInSession,
  mapSecuredValue,
  Session,
} from '../../common';
import { Loader, LoaderOf } from '../../core';
import { SecuredUser, UserLoader } from '../user';
import { CommentThreadLoader } from './comment-thread.loader';
import { CommentLoader } from './comment.loader';
import { CommentService } from './comment.service';
import {
  Comment,
  CommentListInput,
  CommentListOutput,
  CommentThread,
  CreateCommentInput,
  CreateCommentOutput,
  CreateCommentThreadInput,
  CreateCommentThreadOutput,
  DeleteCommentOutput,
  UpdateCommentInput,
  UpdateCommentOutput,
} from './dto';

@Resolver(Comment)
export class CommentResolver {
  constructor(private readonly service: CommentService) {}

  @Mutation(() => CreateCommentOutput, {
    description: 'create a comment',
  })
  async createComment(
    @LoggedInSession() session: Session,
    @Args('input') { comment: input }: CreateCommentInput
  ): Promise<CreateCommentOutput> {
    const comment = await this.service.create(input, session);
    return { comment };
  }

  @Query(() => Comment, {
    description: 'Look up a comment by ID',
  })
  async comment(
    @IdArg() id: ID,
    @Loader(CommentLoader) comments: LoaderOf<CommentLoader>
  ): Promise<Comment> {
    return await comments.load(id);
  }

  @Mutation(() => UpdateCommentOutput, {
    description: 'Update an existing comment',
  })
  async updateComment(
    @LoggedInSession() session: Session,
    @Args('input') { comment: input }: UpdateCommentInput
  ): Promise<UpdateCommentOutput> {
    const comment = await this.service.update(input, session);
    return { comment };
  }

  @Mutation(() => DeleteCommentOutput, {
    description: 'Delete a comment',
  })
  async deleteComment(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<DeleteCommentOutput> {
    await this.service.delete(id, session);
    return { success: true };
  }

  @Mutation(() => CreateCommentThreadOutput, {
    description: 'Create a comment thread',
  })
  async createCommentThread(
    @LoggedInSession() session: Session,
    @Args('input') { commentThread: input }: CreateCommentThreadInput
  ): Promise<CreateCommentThreadOutput> {
    const commentThread = await this.service.createThread(input, session);
    return { commentThread };
  }

  @Query(() => CommentThread, {
    description: 'Look up a comment thread by ID',
  })
  async commentThread(
    @IdArg() id: ID,
    @Loader(CommentThreadLoader) commentThreads: LoaderOf<CommentThreadLoader>
  ): Promise<CommentThread> {
    return await commentThreads.load(id);
  }

  @Query(() => CommentListOutput, {
    description: 'List of comments belonging to a thread',
  })
  async comments(
    @AnonSession() session: Session,
    @ListArg(CommentListInput) input: CommentListInput,
    @Loader(CommentLoader) comments: LoaderOf<CommentLoader>
  ) {
    const list = await this.service.listCommentsByThreadId(
      { ...input, filter: { threadId: input.filter.threadId } },
      session
    );
    comments.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredUser)
  async creator(
    @Parent() comment: Comment,
    @Loader(UserLoader) users: LoaderOf<UserLoader>
  ): Promise<SecuredUser> {
    return await mapSecuredValue(comment.creator, (id) => users.load(id));
  }
}
