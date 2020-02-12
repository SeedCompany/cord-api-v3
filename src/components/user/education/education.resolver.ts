import { Injectable } from '@nestjs/common';
import { Args, Mutation, Query } from '@nestjs/graphql';
import { IdArg } from '../../../common';
import { ISession, Session } from '../../auth';
import {
  CreateEducationInput,
  CreateEducationOutput,
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
    description: 'Read an education entry by user id',
  })
  async education(
    @Session() session: ISession,
    @IdArg() id: string,
  ): Promise<Education> {
    return await this.service.readOne(id, session);
  }

  @Mutation(() => UpdateEducationOutput, {
    description: 'Update an education entry',
  })
  async updateEducation(
    @Session() session: ISession,
    @Args('input') { education: input }: UpdateEducationInput,
  ): Promise<UpdateEducationOutput> {
    const education = await this.service.update(input, session);
    return { education };
  }

  @Mutation(() => Boolean, {
    description: 'Delete an education entry',
  })
  async deleteEducation(
    @Session() session: ISession,
    @IdArg() id: string,
  ): Promise<boolean> {
    await this.service.delete(id, session);
    return true;
  }
}
