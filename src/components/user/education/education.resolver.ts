import { Injectable } from '@nestjs/common';
import { Args, Mutation, Query } from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../../common';
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
    @Session() session: ISession,
    @Args('input') { education: input }: CreateEducationInput
  ): Promise<CreateEducationOutput> {
    const education = await this.service.create(input, session);
    return { education };
  }

  @Query(() => Education, {
    description: 'Look up an education by its ID',
  })
  async education(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<Education> {
    return await this.service.readOne(id, session);
  }

  @Query(() => EducationListOutput, {
    description: 'Look up educations by user id',
  })
  async educations(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => EducationListInput,
      defaultValue: EducationListInput.defaultVal,
    })
    input: EducationListInput
  ): Promise<EducationListOutput> {
    return this.service.list(input, session);
  }

  @Mutation(() => UpdateEducationOutput, {
    description: 'Update an education',
  })
  async updateEducation(
    @Session() session: ISession,
    @Args('input') { education: input }: UpdateEducationInput
  ): Promise<UpdateEducationOutput> {
    const education = await this.service.update(input, session);
    return { education };
  }

  @Mutation(() => Boolean, {
    description: 'Delete an education',
  })
  async deleteEducation(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.service.delete(id, session);
    return true;
  }

  @Query(() => Boolean, {
    description: 'Check Consistency across Education Nodes',
  })
  async checkEducationConsistency(
    @Session() session: ISession
  ): Promise<boolean> {
    return await this.service.checkEducationConsistency(session);
  }
}
