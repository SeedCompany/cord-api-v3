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
import { PartnerLoader, PartnerService } from '../partner';
import {
  ProjectListInput,
  SecuredProjectList,
} from '../project/dto/list-projects.dto';
import { ProjectLoader } from '../project/project.loader';
import { SecuredUser, UserLoader } from '../user';
import {
  CreatePartnerInput,
  CreatePartnerOutput,
  DeletePartnerOutput,
  Partner,
  PartnerListInput,
  PartnerListOutput,
  UpdatePartnerInput,
  UpdatePartnerOutput,
} from './dto';

@Resolver(Partner)
export class PartnerResolver {
  constructor(private readonly partnerService: PartnerService) {}

  @Query(() => Partner, {
    description: 'Look up a partner by its ID',
  })
  async partner(
    @Loader(PartnerLoader) partners: LoaderOf<PartnerLoader>,
    @IdArg() id: ID
  ): Promise<Partner> {
    return await partners.load(id);
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
    input: PartnerListInput,
    @Loader(PartnerLoader) partners: LoaderOf<PartnerLoader>
  ): Promise<PartnerListOutput> {
    const list = await this.partnerService.list(input, session);
    partners.primeAll(list.items);
    return list;
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
    @Loader(UserLoader) users: LoaderOf<UserLoader>
  ): Promise<SecuredUser> {
    return await mapSecuredValue(partner.pointOfContact, (id) =>
      users.load(id)
    );
  }

  @ResolveField(() => SecuredProjectList, {
    description: 'The list of projects the partner has a partnership with.',
  })
  async projects(
    @AnonSession() session: Session,
    @Parent() partner: Partner,
    @Args({
      name: 'input',
      type: () => ProjectListInput,
      defaultValue: ProjectListInput.defaultVal,
    })
    input: ProjectListInput,
    @Loader(ProjectLoader) loader: LoaderOf<ProjectLoader>
  ): Promise<SecuredProjectList> {
    const list = await this.partnerService.listProjects(
      partner,
      input,
      session
    );
    loader.primeAll(list.items);
    return list;
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

  @Mutation(() => DeletePartnerOutput, {
    description: 'Delete a partner',
  })
  async deletePartner(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<DeletePartnerOutput> {
    await this.partnerService.delete(id, session);
    return { success: true };
  }
}
