import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { CeremonyService } from '../ceremony';
import { UpdateCeremonyInput, UpdateCeremonyOutput } from './dto';

@Resolver()
export class CeremonyResolver {
  constructor(private readonly service: CeremonyService) {}

  @Mutation(() => UpdateCeremonyOutput, {
    description: 'Update a ceremony',
  })
  async updateCeremony(
    @Args('input') { ceremony: input }: UpdateCeremonyInput,
  ): Promise<UpdateCeremonyOutput> {
    const ceremony = await this.service.update(input);
    return { ceremony };
  }
}
