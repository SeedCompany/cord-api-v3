import { Injectable } from '@nestjs/common';
import { Args, Mutation, Query } from '@nestjs/graphql';
import { IdArg } from '../../../common';
import { ISession, Session } from '../../auth';
import {
  CreateEducationInput,
  CreateEducationOutput,
  EducationListInput,
  EducationListOutput,
  UpdateEducationInput,
  UpdateEducationOutput,
  Education,
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
    @Args('input') { education: input }: CreateEducationInput,
  ): Promise<CreateEducationOutput> {
    const education = await this.service.create(input, session);
    return { education };
  }

  @Query(() => Education, {
    description: 'Look up an education by its ID',
  })
  async education(
    @Session() session: ISession,
    @IdArg() id: string,
  ): Promise<Education> {
    return await this.service.readOne(id, session);
  }

  @Query(() => EducationListOutput, {
    description: 'Look up educations by user id',
  })
  async organizations(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => EducationListInput,
      defaultValue: EducationListInput.defaultVal,
    })
    input: EducationListInput,
  ): Promise<EducationListOutput> {
    return this.service.educationlist(input, session);
  }

  @Mutation(() => UpdateEducationOutput, {
    description: 'Update an education',
  })
  async updateEducation(
    @Session() session: ISession,
    @Args('input') { education: input }: UpdateEducationInput,
  ): Promise<UpdateEducationOutput> {
    const education = await this.service.update(input, session);
    return { education };
  }

  @Mutation(() => Boolean, {
    description: 'Delete an education',
  })
  async deleteEducation(
    @Session() session: ISession,
    @IdArg() id: string,
  ): Promise<boolean> {
    await this.service.delete(id, session);
    return true;
  }
}
