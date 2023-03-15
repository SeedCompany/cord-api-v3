import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { ID, IdArg, LoggedInSession, Session } from '../../common';
import { Loader, LoaderOf } from '../../core';
import { User, UserLoader } from '../user';
import { CommentService } from './comment.service';
import {
  Comment,
  DeleteCommentOutput,
  UpdateCommentInput,
  UpdateCommentOutput,
} from './dto';

@Resolver(Comment)
export class CommentResolver {
  constructor(private readonly service: CommentService) {}

  @Mutation(() => UpdateCommentOutput, {
    description: 'Update an existing comment',
  })
  async updateComment(
    @LoggedInSession() session: Session,
    @Args('input') input: UpdateCommentInput,
  ): Promise<UpdateCommentOutput> {
    const comment = await this.service.update(input, session);
    return { comment };
  }

  @Mutation(() => DeleteCommentOutput, {
    description: 'Delete a comment',
  })
  async deleteComment(
    @LoggedInSession() session: Session,
    @IdArg() id: ID,
  ): Promise<DeleteCommentOutput> {
    await this.service.delete(id, session);
    return { success: true };
  }

  @ResolveField(() => User)
  async creator(
    @Parent() comment: Comment,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<User> {
    return await users.load(comment.creator);
  }
}
