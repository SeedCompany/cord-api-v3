import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { CeremonyService } from '../ceremony';
import { CeremonyUpdated, UpdateCeremony } from './dto';

@Resolver()
export class CeremonyResolver {
  constructor(private readonly service: CeremonyService) {}

  @Mutation(() => CeremonyUpdated, {
    description: 'Update a ceremony',
  })
  async updateCeremony(
    @Args('input') input: UpdateCeremony,
  ): Promise<CeremonyUpdated> {
    const ceremony = await this.service.update(input);
    return { ceremony };
  }
}
