import { Injectable } from '@nestjs/common';
import { Args, Mutation, Query } from '@nestjs/graphql';
import {
  AnonSession,
  ID,
  IdArg,
  LoggedInSession,
  Session,
} from '../../../common';
import {
  CreateEducationInput,
  CreateEducationOutput,
  Education,
  EducationListInput,
  EducationListOutput,
  UpdateEducationInput,
  UpdateEducationOutput,
} from './dto';
import { EducationService } from './education.service';

@Injectable()
export class EducationResolver {
  constructor(private readonly service: EducationService) {}

  @Mutation(() => CreateEducationOutput, {
    description: 'Create an education entry',
  })
  async createEducation(
    @LoggedInSession() session: Session,
    @Args('input') { education: input }: CreateEducationInput
  ): Promise<CreateEducationOutput> {
    const education = await this.service.create(input, session);
    return { education };
  }

  @Query(() => Education, {
    description: 'Look up an education by its ID',
  })
  async education(
    @AnonSession() session: Session,
    @IdArg() id: ID
  ): Promise<Education> {
    return await this.service.readOne(id, session);
  }

  @Query(() => EducationListOutput, {
    description: 'Look up educations by user id',
  })
  async educations(
    @AnonSession() session: Session,
    @Args({
      name: 'input',
      type: () => EducationListInput,
      defaultValue: EducationListInput.defaultVal,
    })
    input: EducationListInput
  ): Promise<EducationListOutput> {
    return await this.service.list(input, session);
  }

  @Mutation(() => UpdateEducationOutput, {
    description: 'Update an education',
  })
  async updateEducation(
    @LoggedInSession() session: Session,
    @Args('input') { education: input }: UpdateEducationInput
  ): Promise<UpdateEducationOutput> {
    const education = await this.service.update(input, session);
    return { education };
  }

  @Mutation(() => Boolean, {
    description: 'Delete an education',
  })
  async deleteEducation(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<boolean> {
    await this.service.delete(id, session);
    return true;
  }
}
