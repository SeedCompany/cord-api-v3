import { Injectable } from '@nestjs/common';
import { Args, Mutation, Query } from '@nestjs/graphql';
import { IdArg, RequestUser, IRequestUser } from '../../../common';
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
    @RequestUser() token: IRequestUser,
    @Args('input') { education: input }: CreateEducationInput,
  ): Promise<CreateEducationOutput> {
    const education = await this.service.create(input, token);
    return { education };
  }

  @Query(() => Education, {
    description: 'Read an education entry by user id',
  })
  async education(
    @RequestUser() token: IRequestUser,
    @IdArg() id: string,
  ): Promise<Education> {
    return await this.service.readOne(id, token);
  }

  @Mutation(() => UpdateEducationOutput, {
    description: 'Update an education entry',
  })
  async updateEducation(
    @RequestUser() token: IRequestUser,
    @Args('input') { education: input }: UpdateEducationInput,
  ): Promise<UpdateEducationOutput> {
    const education = await this.service.update(input, token);
    return { education };
  }

  @Mutation(() => Boolean, {
    description: 'Delete an education entry',
  })
  async deleteEducation(
    @RequestUser() token: IRequestUser,
    @IdArg() id: string,
  ): Promise<boolean> {
    await this.service.delete(id, token);
    return true;
  }
}
