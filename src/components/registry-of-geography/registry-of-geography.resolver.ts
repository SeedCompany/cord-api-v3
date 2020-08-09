import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
import {
  CreateRegistryOfGeographyInput,
  CreateRegistryOfGeographyOutput,
  RegistryOfGeography,
  RegistryOfGeographyListInput,
  RegistryOfGeographyListOutput,
  UpdateRegistryOfGeographyInput,
  UpdateRegistryOfGeographyOutput,
} from './dto';
import { RegistryOfGeographyService } from './registry-of-geography.service';

@Resolver(RegistryOfGeography)
export class RegistryOfGeographyResolver {
  constructor(
    private readonly registryOfGeographyService: RegistryOfGeographyService
  ) {}

  @Query(() => RegistryOfGeography, {
    description: 'Look up a registry of geography by its ID',
  })
  async registryOfGeography(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<RegistryOfGeography> {
    return this.registryOfGeographyService.readOne(id, session);
  }

  @Query(() => RegistryOfGeographyListOutput, {
    description: 'Look up registry of geographies',
  })
  async registryOfGeographys(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => RegistryOfGeographyListInput,
      defaultValue: RegistryOfGeographyListInput.defaultVal,
    })
    input: RegistryOfGeographyListInput
  ): Promise<RegistryOfGeographyListOutput> {
    return this.registryOfGeographyService.list(input, session);
  }

  @Mutation(() => CreateRegistryOfGeographyOutput, {
    description: 'Create a registry of geography',
  })
  async createRegistryOfGeography(
    @Session() session: ISession,
    @Args('input')
    { registryOfGeography: input }: CreateRegistryOfGeographyInput
  ): Promise<CreateRegistryOfGeographyOutput> {
    const registryOfGeography = await this.registryOfGeographyService.create(
      input,
      session
    );
    return { registryOfGeography };
  }

  @Mutation(() => UpdateRegistryOfGeographyOutput, {
    description: 'Update a registry of geography',
  })
  async updateRegistryOfGeography(
    @Session() session: ISession,
    @Args('input')
    { registryOfGeography: input }: UpdateRegistryOfGeographyInput
  ): Promise<UpdateRegistryOfGeographyOutput> {
    const registryOfGeography = await this.registryOfGeographyService.update(
      input,
      session
    );
    return { registryOfGeography };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a registry of geography',
  })
  async deleteRegistryOfGeography(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.registryOfGeographyService.delete(id, session);
    return true;
  }
}
