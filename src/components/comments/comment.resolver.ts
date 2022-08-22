import {
  Args,
  Mutation,
  Parent,
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
import { SecuredUser, UserLoader } from '../user';
import { CommentService } from './comment.service';
import {
  Comment,
  CreateCommentInput,
  CreateCommentOutput,
  DeleteCommentOutput,
  UpdateCommentInput,
  UpdateCommentOutput,
} from './dto';

@Resolver(Comment)
export class CommentResolver {
  constructor(private readonly service: CommentService) {}

  @Mutation(() => CreateCommentOutput, {
    description: 'Create a comment',
  })
  async createComment(
    @LoggedInSession() session: Session,
    @Args('input') input: CreateCommentInput
  ): Promise<CreateCommentOutput> {
    if (!input.threadId) {
      const commentThread = await this.service.createThread(
        { parentId: input.resourceId },
        session
      );

      const comment = await this.service.create(
        { ...input, threadId: commentThread.id },
        session
      );

      return { comment, commentThread };
    }

    const comment = await this.service.create(input, session);
    const commentThread = await this.service.readOneThread(
      input.threadId,
      session
    );
    return { comment, commentThread };
  }

  @Mutation(() => UpdateCommentOutput, {
    description: 'Update an existing comment',
  })
  async updateComment(
    @LoggedInSession() session: Session,
    @Args('input') input: UpdateCommentInput
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

  @ResolveField(() => SecuredUser, {
    description: 'Get comment creator',
  })
  async creator(
    @Parent() comment: Comment,
    @Loader(UserLoader) users: LoaderOf<UserLoader>
  ): Promise<SecuredUser> {
    return await mapSecuredValue(comment.creator, (id) => users.load(id));
  }
}
