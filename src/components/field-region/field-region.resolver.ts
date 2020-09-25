import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
import {
  CreateFieldRegionInput,
  CreateFieldRegionOutput,
  FieldRegion,
  FieldRegionListInput,
  FieldRegionListOutput,
  UpdateFieldRegionInput,
  UpdateFieldRegionOutput,
} from './dto';
import { FieldRegionService } from './field-region.service';

@Resolver()
export class FieldRegionResolver {
  constructor(private readonly fieldRegionService: FieldRegionService) {}

  @Query(() => FieldRegion, {
    description: 'Read one field region by id',
  })
  async fieldRegion(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<FieldRegion> {
    return await this.fieldRegionService.readOne(id, session);
  }

  @Query(() => FieldRegionListOutput, {
    description: 'Look up field regions',
  })
  async fieldRegions(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => FieldRegionListInput,
      defaultValue: FieldRegionListInput.defaultVal,
    })
    input: FieldRegionListInput
  ): Promise<FieldRegionListOutput> {
    return this.fieldRegionService.list(input, session);
  }

  @Mutation(() => CreateFieldRegionOutput, {
    description: 'Create a field region',
  })
  async createFieldRegion(
    @Session() session: ISession,
    @Args('input') { fieldRegion: input }: CreateFieldRegionInput
  ): Promise<CreateFieldRegionOutput> {
    const fieldRegion = await this.fieldRegionService.create(input, session);
    return { fieldRegion };
  }

  @Mutation(() => UpdateFieldRegionOutput, {
    description: 'Update a field region',
  })
  async updateFieldRegion(
    @Session() session: ISession,
    @Args('input') { fieldRegion: input }: UpdateFieldRegionInput
  ): Promise<UpdateFieldRegionOutput> {
    const fieldRegion = await this.fieldRegionService.update(input, session);
    return { fieldRegion };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a field region',
  })
  async deleteFieldRegion(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.fieldRegionService.delete(id, session);
    return true;
  }
}
