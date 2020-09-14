import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
import { OrganizationService, SecuredOrganization } from '../organization';
import {
  CreatePartnerInput,
  CreatePartnerOutput,
  Partner,
  PartnerListInput,
  PartnerListOutput,
  UpdatePartnerInput,
  UpdatePartnerOutput,
} from './dto';
import { PartnerService } from './partner.service';

@Resolver(Partner)
export class PartnerResolver {
  constructor(
    private readonly partnerService: PartnerService,
    private readonly orgService: OrganizationService
  ) {}

  @Query(() => Partner, {
    description: 'Look up a partner by its ID',
  })
  async partner(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<Partner> {
    return await this.partnerService.readOne(id, session);
  }

  @Query(() => PartnerListOutput, {
    description: 'Look up partners',
  })
  async partners(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => PartnerListInput,
      defaultValue: PartnerListInput.defaultVal,
    })
    input: PartnerListInput
  ): Promise<PartnerListOutput> {
    return this.partnerService.list(input, session);
  }

  @ResolveField(() => SecuredOrganization)
  async organization(
    @Parent() partner: Partner,
    @Session() session: ISession
  ): Promise<SecuredOrganization> {
    const { value: id, ...rest } = partner.organization;
    const value = id ? await this.orgService.readOne(id, session) : undefined;
    return {
      value,
      ...rest,
    };
  }

  @Mutation(() => CreatePartnerOutput, {
    description: 'Create a partner',
  })
  async createPartner(
    @Session() session: ISession,
    @Args('input') { partner: input }: CreatePartnerInput
  ): Promise<CreatePartnerOutput> {
    const partner = await this.partnerService.create(input, session);
    return { partner };
  }

  @Mutation(() => UpdatePartnerOutput, {
    description: 'Update a partner',
  })
  async updatePartner(
    @Session() session: ISession,
    @Args('input') { partner: input }: UpdatePartnerInput
  ): Promise<UpdatePartnerOutput> {
    const partner = await this.partnerService.update(input, session);
    return { partner };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a partner',
  })
  async deletePartner(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.partnerService.delete(id, session);
    return true;
  }
}
