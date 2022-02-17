import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  AnonSession,
  ID,
  IdArg,
  ListArg,
  LoggedInSession,
  Session,
} from '../../common';
import { Loader, LoaderOf } from '../../core';
import { CeremonyLoader, CeremonyService } from '../ceremony';
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
    @IdArg() id: ID,
    @Loader(CeremonyLoader) ceremonies: LoaderOf<CeremonyLoader>
  ): Promise<Ceremony> {
    return await ceremonies.load(id);
  }

  @Query(() => CeremonyListOutput, {
    description: 'Look up ceremonies',
  })
  async ceremonies(
    @AnonSession() session: Session,
    @ListArg(CeremonyListInput) input: CeremonyListInput,
    @Loader(CeremonyLoader) ceremonies: LoaderOf<CeremonyLoader>
  ): Promise<CeremonyListOutput> {
    const list = await this.service.list(input, session);
    ceremonies.primeAll(list.items);
    return list;
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
