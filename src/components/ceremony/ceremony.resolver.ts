import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
import { CeremonyService } from './ceremony.service';
import {
  Ceremony,
  CeremonyListInput,
  CeremonyListOutput,
  UpdateCeremonyInput,
  UpdateCeremonyOutput,
} from './dto';

@Resolver()
export class CeremonyResolver {
  constructor(private readonly service: CeremonyService) {}

  @Query(() => Ceremony, {
    description: 'Look up a ceremony by its ID',
  })
  async ceremony(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<Ceremony> {
    return await this.service.readOne(id, session);
  }

  @Query(() => CeremonyListOutput, {
    description: 'Look up ceremonies',
  })
  async ceremonies(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => CeremonyListInput,
      defaultValue: CeremonyListInput.defaultVal,
    })
    input: CeremonyListInput
  ): Promise<CeremonyListOutput> {
    return this.service.list(input, session);
  }

  @Mutation(() => UpdateCeremonyOutput, {
    description: 'Update a ceremony',
  })
  async updateCeremony(
    @Session() session: ISession,
    @Args('input') { ceremony: input }: UpdateCeremonyInput
  ): Promise<UpdateCeremonyOutput> {
    const ceremony = await this.service.update(input, session);
    return { ceremony };
  }

  // Ceremonies are created automatically via engagements
  // async createCeremony() {}

  // Ceremonies are deleted automatically via engagements
  // async deleteCeremony() {}

  @Query(() => Boolean, {
    description: 'Check Consistency in Ceremony Nodes',
  })
  async checkCeremonyConsistency(
    @Session() session: ISession
  ): Promise<boolean> {
    return await this.service.checkCeremonyConsistency(session);
  }
}
