import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import {
  type ID,
  IdArg,
  ListArg,
  loadManyIgnoreMissingThrowAny,
  loadSecuredIds,
  mapSecuredValue,
} from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { EngagementLoader } from '../engagement';
import { EngagementListInput, EngagementListOutput } from '../engagement/dto';
import { FieldRegionLoader } from '../field-region';
import { SecuredFieldRegions } from '../field-region/dto';
import { LanguageLoader } from '../language';
import {
  LanguageListInput,
  SecuredLanguageList,
  SecuredLanguageNullable,
  SecuredLanguages,
} from '../language/dto';
import { LocationLoader } from '../location';
import { SecuredLocations } from '../location/dto';
import { OrganizationLoader } from '../organization';
import { SecuredOrganization } from '../organization/dto';
import { PartnerLoader, PartnerService } from '../partner';
import { ProjectLoader } from '../project';
import { ProjectListInput, SecuredProjectList } from '../project/dto';
import { UserLoader } from '../user';
import { SecuredUser } from '../user/dto';
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
    @IdArg() id: ID,
  ): Promise<Partner> {
    return await partners.load(id);
  }

  @Query(() => PartnerListOutput, {
    description: 'Look up partners',
  })
  async partners(
    @ListArg(PartnerListInput) input: PartnerListInput,
    @Loader(PartnerLoader) partners: LoaderOf<PartnerLoader>,
  ): Promise<PartnerListOutput> {
    const list = await this.partnerService.list(input);
    partners.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredOrganization)
  async organization(
    @Parent() partner: Partner,
    @Loader(OrganizationLoader) organizations: LoaderOf<OrganizationLoader>,
  ): Promise<SecuredOrganization> {
    return await mapSecuredValue(partner.organization, ({ id }) => organizations.load(id));
  }

  @ResolveField(() => SecuredUser)
  async pointOfContact(
    @Parent() partner: Partner,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<SecuredUser> {
    return await mapSecuredValue(partner.pointOfContact, ({ id }) => users.load(id));
  }

  @ResolveField(() => SecuredLanguageNullable)
  async languageOfWiderCommunication(
    @Parent() partner: Partner,
    @Loader(LanguageLoader) languages: LoaderOf<LanguageLoader>,
  ): Promise<SecuredLanguageNullable> {
    return await mapSecuredValue(partner.languageOfWiderCommunication, ({ id }) =>
      languages.load({ id, view: { active: true } }),
    );
  }

  @ResolveField(() => SecuredFieldRegions)
  async fieldRegions(
    @Parent() partner: Partner,
    @Loader(FieldRegionLoader) loader: LoaderOf<FieldRegionLoader>,
  ): Promise<SecuredFieldRegions> {
    return await loadSecuredIds(loader, {
      ...partner.fieldRegions,
      value: partner.fieldRegions.value.map((region) => region.id),
    });
  }

  @ResolveField(() => SecuredLocations)
  async countries(
    @Parent() partner: Partner,
    @Loader(LocationLoader) loader: LoaderOf<LocationLoader>,
  ): Promise<SecuredLocations> {
    return await loadSecuredIds(loader, {
      ...partner.countries,
      value: partner.countries.value.map((country) => country.id),
    });
  }

  @ResolveField(() => SecuredLanguages)
  async languagesOfConsulting(
    @Parent() partner: Partner,
    @Loader(LanguageLoader) loader: LoaderOf<LanguageLoader>,
  ): Promise<SecuredLanguages> {
    const { value: languages, ...rest } = partner.languagesOfConsulting;
    const value = await loadManyIgnoreMissingThrowAny(
      loader,
      languages.map(({ id }) => ({ id, view: { active: true } } as const)),
    );
    return { ...rest, value };
  }

  @ResolveField(() => SecuredProjectList, {
    description: 'The list of projects the partner has a partnership with.',
  })
  async projects(
    @Parent() partner: Partner,
    @ListArg(ProjectListInput) input: ProjectListInput,
    @Loader(ProjectLoader) loader: LoaderOf<ProjectLoader>,
  ): Promise<SecuredProjectList> {
    const list = await this.partnerService.listProjects(partner, input);
    loader.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredLanguageList, {
    description: "Languages of the partner's affiliated translation projects",
  })
  async languages(
    @Parent() partner: Partner,
    @ListArg(LanguageListInput) input: LanguageListInput,
    @Loader(LanguageLoader) loader: LoaderOf<LanguageLoader>,
  ): Promise<SecuredLanguageList> {
    const list = await this.partnerService.listLanguages(partner, input);
    loader.primeAll(list.items);
    return list;
  }

  @ResolveField(() => EngagementListOutput, {
    description: "Engagements of the partner's affiliated projects",
  })
  async engagements(
    @Parent() partner: Partner,
    @ListArg(EngagementListInput) input: EngagementListInput,
    @Loader(EngagementLoader) loader: LoaderOf<EngagementLoader>,
  ): Promise<EngagementListOutput> {
    const list = await this.partnerService.listEngagements(partner, input);
    loader.primeAll(list.items);
    return list;
  }

  @Mutation(() => CreatePartnerOutput, {
    description: 'Create a partner',
  })
  async createPartner(
    @Args('input') { partner: input }: CreatePartnerInput,
  ): Promise<CreatePartnerOutput> {
    const partner = await this.partnerService.create(input);
    return { partner };
  }

  @Mutation(() => UpdatePartnerOutput, {
    description: 'Update a partner',
  })
  async updatePartner(
    @Args('input') { partner: input }: UpdatePartnerInput,
  ): Promise<UpdatePartnerOutput> {
    const partner = await this.partnerService.update(input);
    return { partner };
  }

  @Mutation(() => DeletePartnerOutput, {
    description: 'Delete a partner',
  })
  async deletePartner(@IdArg() id: ID): Promise<DeletePartnerOutput> {
    await this.partnerService.delete(id);
    return { success: true };
  }
}
