import { Injectable } from '@nestjs/common';
import { Args, Mutation } from '@nestjs/graphql';
import { IdArg, RequestUser } from '../../../common';
import {
  CreateEducationInput,
  CreateEducationOutput,
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
    @RequestUser() token: string,
    @Args('input') { education: input }: CreateEducationInput,
  ): Promise<CreateEducationOutput> {
    const education = await this.service.create(input, token);
    return { education };
  }

  @Mutation(() => UpdateEducationOutput, {
    description: 'Update an education entry',
  })
  async updateEducation(
    @RequestUser() token: string,
    @Args('input') { education: input }: UpdateEducationInput,
  ): Promise<UpdateEducationOutput> {
    const education = await this.service.update(input, token);
    return { education };
  }

  @Mutation(() => Boolean, {
    description: 'Delete an education entry',
  })
  async deleteEducation(
    @RequestUser() token: string,
    @IdArg() id: string,
  ): Promise<boolean> {
    await this.service.delete(id, token);
    return true;
  }
}
