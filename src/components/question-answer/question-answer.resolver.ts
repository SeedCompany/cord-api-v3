import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { ID, IdArg, LoggedInSession, Session } from '../../common';
import { Loader, LoaderOf } from '../../core';
import { FileNodeLoader, resolveDirectory, SecuredDirectory } from '../file';
import {
  CreateQuestionAnswer,
  QuestionAnswer,
  UpdateQuestionAnswer,
} from './dto';
import { QuestionAnswerService } from './question-answer.service';

@Resolver(QuestionAnswer)
export class QuestionAnswerResolver {
  constructor(private readonly qa: QuestionAnswerService) {}

  @ResolveField(() => SecuredDirectory)
  async media(
    @Parent() qa: QuestionAnswer,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>
  ) {
    return await resolveDirectory(files, qa.media);
  }

  @Mutation(() => QuestionAnswer, {
    description: 'Create a question/answer',
  })
  async createQuestionAnswer(
    @LoggedInSession() session: Session,
    @Args('input') input: CreateQuestionAnswer
  ): Promise<QuestionAnswer> {
    return await this.qa.create(input, session);
  }

  @Mutation(() => QuestionAnswer, {
    description: 'Update a question/answer',
  })
  async updateQuestionAnswer(
    @LoggedInSession() session: Session,
    @Args('input') input: UpdateQuestionAnswer
  ): Promise<QuestionAnswer> {
    return await this.qa.update(input, session);
  }

  @Mutation(() => Boolean, {
    description: 'Delete a question/answer',
  })
  async deleteQuestionAnswer(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<boolean> {
    await this.qa.delete(id, session);
    return true;
  }
}
