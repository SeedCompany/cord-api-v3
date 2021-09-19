import { forwardRef, Inject } from '@nestjs/common';
import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  AnonSession,
  ID,
  IdArg,
  LoggedInSession,
  mapSecuredValue,
  Session,
} from '../../common';
import { Loader, LoaderOf } from '../../core';
import { OrganizationLoader, SecuredOrganization } from '../organization';
import { SecuredUser, UserService } from '../user';
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
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService
  ) {}

  @Query(() => Partner, {
    description: 'Look up a partner by its ID',
  })
  async partner(
    @AnonSession() session: Session,
    @IdArg() id: ID
  ): Promise<Partner> {
    return await this.partnerService.readOne(id, session);
  }

  @Query(() => PartnerListOutput, {
    description: 'Look up partners',
  })
  async partners(
    @AnonSession() session: Session,
    @Args({
      name: 'input',
      type: () => PartnerListInput,
      defaultValue: PartnerListInput.defaultVal,
    })
    input: PartnerListInput
  ): Promise<PartnerListOutput> {
    return await this.partnerService.list(input, session);
  }

  @ResolveField(() => SecuredOrganization)
  async organization(
    @Parent() partner: Partner,
    @Loader(OrganizationLoader) organizations: LoaderOf<OrganizationLoader>
  ): Promise<SecuredOrganization> {
    return await mapSecuredValue(partner.organization, (id) =>
      organizations.load(id)
    );
  }

  @ResolveField(() => SecuredUser)
  async pointOfContact(
    @Parent() partner: Partner,
    @AnonSession() session: Session
  ): Promise<SecuredUser> {
    const { value: id, ...rest } = partner.pointOfContact;
    const value = id ? await this.userService.readOne(id, session) : undefined;
    return {
      value,
      ...rest,
    };
  }

  @Mutation(() => CreatePartnerOutput, {
    description: 'Create a partner',
  })
  async createPartner(
    @LoggedInSession() session: Session,
    @Args('input') { partner: input }: CreatePartnerInput
  ): Promise<CreatePartnerOutput> {
    const partner = await this.partnerService.create(input, session);
    return { partner };
  }

  @Mutation(() => UpdatePartnerOutput, {
    description: 'Update a partner',
  })
  async updatePartner(
    @LoggedInSession() session: Session,
    @Args('input') { partner: input }: UpdatePartnerInput
  ): Promise<UpdatePartnerOutput> {
    const partner = await this.partnerService.update(input, session);
    return { partner };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a partner',
  })
  async deletePartner(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<boolean> {
    await this.partnerService.delete(id, session);
    return true;
  }
}
