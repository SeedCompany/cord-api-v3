import { Args, Query, Mutation, Resolver } from '@nestjs/graphql';
import { PartnershipService } from './partnership.service';
import {
  CreatePartnershipOutput,
  CreatePartnershipInput,
  Partnership,
  UpdatePartnershipOutput,
  UpdatePartnershipInput,
  PartnershipListInput,
  PartnershipListOutput,
} from './dto';
import { Session, ISession } from '../auth';
import { IdArg } from '../../common';

@Resolver()
export class PartnershipResolver {
  constructor(private readonly service: PartnershipService) {}

  @Mutation(() => CreatePartnershipOutput, {
    description: 'Create a Partnership entry',
  })
  async createPartnership(
    @Session() session: ISession,
    @Args('input') { partnership: input }: CreatePartnershipInput,
  ): Promise<CreatePartnershipOutput> {
    const partnership = await this.service.create(input, session);
    return { partnership };
  }

  @Query(() => Partnership, {
    description: 'Look up a partnership by ID',
  })
  async partnership(
    @Session() session: ISession,
    @IdArg() id: string,
  ): Promise<Partnership> {
    return await this.service.readOne(id, session);
  }

  @Query(() => PartnershipListOutput, {
    description: 'Look up partnerships',
  })
  async partnerships(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => PartnershipListInput,
      defaultValue: PartnershipListInput.defaultVal,
    })
    input: PartnershipListInput,
  ): Promise<PartnershipListOutput> {
    return this.service.list(input, session);
  }

  @Mutation(() => UpdatePartnershipOutput, {
    description: 'Update a Partnership',
  })
  async updatePartnership(
    @Session() session: ISession,
    @Args('input') { partnership: input }: UpdatePartnershipInput,
  ): Promise<UpdatePartnershipOutput> {
    const partnership = await this.service.update(input, session);
    return { partnership };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a Partnership',
  })
  async deletePartnership(
    @Session() session: ISession,
    @IdArg() id: string,
  ): Promise<boolean> {
    await this.service.delete(id, session);
    return true;
  }
}
