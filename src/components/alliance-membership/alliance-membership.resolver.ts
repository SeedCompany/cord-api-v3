import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { ID, IdArg, mapSecuredValue } from '~/common';
import { Loader, LoaderOf } from '~/core';
import { OrganizationLoader } from '../organization';
import { SecuredOrganization } from '../organization/dto';
import { AllianceMembershipLoader } from './alliance-membership.loader';
import { AllianceMembershipService } from './alliance-membership.service';
import { AllianceMembership } from './dto/alliance-membership.dto';
import {
  CreateAllianceMembershipInput,
  CreateAllianceMembershipOutput,
} from './dto/create-alliance-membership.dto';
import { DeleteAllianceMembershipOutput } from './dto/delete-alliance-membership.dto';

@Resolver(AllianceMembership)
export class AllianceMembershipResolver {
  constructor(private readonly service: AllianceMembershipService) {}

  @Query(() => AllianceMembership, {
    description: 'Read one field zone by id',
  })
  async allianceMembership(
    @Loader(AllianceMembershipLoader)
    allianceMemberships: LoaderOf<AllianceMembershipLoader>,
    @IdArg() id: ID,
  ): Promise<AllianceMembership> {
    return await allianceMemberships.load(id);
  }

  @Mutation(() => CreateAllianceMembershipOutput, {
    description: 'Create an alliance membership',
  })
  async createAllianceMembership(
    @Args('input') { allianceMembership: input }: CreateAllianceMembershipInput,
  ): Promise<CreateAllianceMembershipOutput> {
    const allianceMembership = await this.service.create(input);
    return { allianceMembership };
  }

  @Mutation(() => DeleteAllianceMembershipOutput, {
    description: 'Delete an alliance membership',
  })
  async deleteAllianceMembership(
    @IdArg() id: ID,
  ): Promise<DeleteAllianceMembershipOutput> {
    await this.service.delete(id);
    return { success: true };
  }

  @ResolveField(() => SecuredOrganization)
  async member(
    @Parent() allianceMembership: AllianceMembership,
    @Loader(OrganizationLoader) organizations: LoaderOf<OrganizationLoader>,
  ): Promise<SecuredOrganization> {
    return await mapSecuredValue(allianceMembership.member, ({ id }) =>
      organizations.load(id),
    );
  }

  @ResolveField(() => SecuredOrganization)
  async alliance(
    @Parent() allianceMembership: AllianceMembership,
    @Loader(OrganizationLoader) organizations: LoaderOf<OrganizationLoader>,
  ): Promise<SecuredOrganization> {
    return await mapSecuredValue(allianceMembership.alliance, ({ id }) =>
      organizations.load(id),
    );
  }
}
