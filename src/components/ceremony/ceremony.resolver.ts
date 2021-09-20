import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AnonSession, ID, IdArg, LoggedInSession, Session } from '../../common';
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
    @AnonSession() session: Session,
    @IdArg() id: ID
  ): Promise<Ceremony> {
    return await this.service.readOne(id, session);
  }

  @Query(() => CeremonyListOutput, {
    description: 'Look up ceremonies',
  })
  async ceremonies(
    @AnonSession() session: Session,
    @Args({
      name: 'input',
      type: () => CeremonyListInput,
      defaultValue: CeremonyListInput.defaultVal,
    })
    input: CeremonyListInput
  ): Promise<CeremonyListOutput> {
    return await this.service.list(input, session);
  }

  @Mutation(() => UpdateCeremonyOutput, {
    description: 'Update a ceremony',
  })
  async updateCeremony(
    @LoggedInSession() session: Session,
    @Args('input') { ceremony: input }: UpdateCeremonyInput
  ): Promise<UpdateCeremonyOutput> {
    const ceremony = await this.service.update(input, session);
    return { ceremony };
  }

  // Ceremonies are created automatically via engagements
  // async createCeremony() {}

  // Ceremonies are deleted automatically via engagements
  // async deleteCeremony() {}
}
