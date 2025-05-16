import { Injectable } from '@nestjs/common';
import { Args, Mutation, Query } from '@nestjs/graphql';
import { type ID, IdArg, ListArg } from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { EducationLoader, EducationService } from '../education';
import {
  CreateEducationInput,
  CreateEducationOutput,
  DeleteEducationOutput,
  Education,
  EducationListInput,
  EducationListOutput,
  UpdateEducationInput,
  UpdateEducationOutput,
} from './dto';

@Injectable()
export class EducationResolver {
  constructor(private readonly service: EducationService) {}

  @Mutation(() => CreateEducationOutput, {
    description: 'Create an education entry',
    deprecationReason: `This is unfinished functionality, don't use`,
  })
  async createEducation(
    @Args('input') { education: input }: CreateEducationInput,
  ): Promise<CreateEducationOutput> {
    const education = await this.service.create(input);
    return { education };
  }

  @Query(() => Education, {
    description: 'Look up an education by its ID',
    deprecationReason: 'Query via user instead',
  })
  async education(
    @Loader(EducationLoader) educations: LoaderOf<EducationLoader>,
    @IdArg() id: ID,
  ): Promise<Education> {
    return await educations.load(id);
  }

  @Query(() => EducationListOutput, {
    description: 'Look up educations by user id',
    deprecationReason: 'Query via user instead',
  })
  async educations(
    @ListArg(EducationListInput) input: EducationListInput,
    @Loader(EducationLoader) educations: LoaderOf<EducationLoader>,
  ): Promise<EducationListOutput> {
    const list = await this.service.list(input);
    educations.primeAll(list.items);
    return list;
  }

  @Mutation(() => UpdateEducationOutput, {
    description: 'Update an education',
    deprecationReason: `This is unfinished functionality, don't use`,
  })
  async updateEducation(
    @Args('input') { education: input }: UpdateEducationInput,
  ): Promise<UpdateEducationOutput> {
    const education = await this.service.update(input);
    return { education };
  }

  @Mutation(() => DeleteEducationOutput, {
    description: 'Delete an education',
    deprecationReason: `This is unfinished functionality, don't use`,
  })
  async deleteEducation(@IdArg() id: ID): Promise<DeleteEducationOutput> {
    await this.service.delete(id);
    return { success: true };
  }
}
