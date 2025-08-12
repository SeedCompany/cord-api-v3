import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  InvalidIdForTypeException,
  ListArg,
  mapSecuredValue,
  SecuredDateRange,
} from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { CeremonyLoader } from '../ceremony';
import { SecuredCeremony } from '../ceremony/dto';
import { ChangesetIds, type IdsAndView, IdsAndViewArg } from '../changeset/dto';
import { EngagementLoader, EngagementService } from '../engagement';
import { SecuredToolList } from '../tool/dto';
import { ToolUsageService } from '../tool/tool-usage/tool-usage.service';
import {
  CreateInternshipEngagementInput,
  CreateInternshipEngagementOutput,
  CreateLanguageEngagementInput,
  CreateLanguageEngagementOutput,
  DeleteEngagementOutput,
  type Engagement,
  EngagementListInput,
  EngagementListOutput,
  IEngagement,
  LanguageEngagement,
  LanguageEngagementListOutput,
  UpdateInternshipEngagementInput,
  UpdateInternshipEngagementOutput,
  UpdateLanguageEngagementInput,
  UpdateLanguageEngagementOutput,
} from './dto';

@Resolver(IEngagement)
export class EngagementResolver {
  constructor(
    private readonly service: EngagementService,
    private readonly toolUsageService: ToolUsageService,
  ) {}

  @Query(() => IEngagement, {
    description: 'Lookup an engagement by ID',
  })
  async engagement(
    @IdsAndViewArg() key: IdsAndView,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>,
  ): Promise<Engagement> {
    return await engagements.load(key);
  }

  @Query(() => LanguageEngagement, {
    description: 'Lookup a LanguageEngagement by ID',
  })
  async languageEngagement(
    @IdsAndViewArg() key: IdsAndView,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>,
  ): Promise<Engagement> {
    const engagement = await engagements.load(key);
    if (LanguageEngagement.resolve(engagement) !== LanguageEngagement) {
      throw new InvalidIdForTypeException();
    }
    return engagement;
  }

  @Query(() => EngagementListOutput, {
    description: 'Look up engagements',
  })
  async engagements(
    @ListArg(EngagementListInput) input: EngagementListInput,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>,
  ): Promise<EngagementListOutput> {
    const list = await this.service.list(input);
    engagements.primeAll(list.items);
    return list;
  }

  @Query(() => LanguageEngagementListOutput, {
    description: 'Look up language engagements',
  })
  async languageEngagements(
    @ListArg(EngagementListInput) input: EngagementListInput,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>,
  ): Promise<EngagementListOutput> {
    const list = await this.service.list({
      ...input,
      filter: { ...input.filter, type: 'language' },
    });
    engagements.primeAll(list.items);

    return list;
  }

  @ResolveField(() => SecuredCeremony)
  async ceremony(
    @Parent() engagement: Engagement,
    @Loader(CeremonyLoader) ceremonies: LoaderOf<CeremonyLoader>,
  ): Promise<SecuredCeremony> {
    return await mapSecuredValue(engagement.ceremony, ({ id }) =>
      ceremonies.load(id),
    );
  }

  @ResolveField()
  dateRange(@Parent() engagement: Engagement): SecuredDateRange {
    return SecuredDateRange.fromPair(engagement.startDate, engagement.endDate);
  }

  @ResolveField()
  dateRangeOverride(@Parent() engagement: Engagement): SecuredDateRange {
    return SecuredDateRange.fromPair(
      engagement.startDateOverride,
      engagement.endDateOverride,
    );
  }

  @ResolveField(() => SecuredToolList, {
    description: 'All tool usages connected to this engagement',
  })
  async toolUsages(@Parent() engagement: Engagement) {
    return await this.toolUsageService.listAllByEngagementId(engagement.id);
  }

  @Mutation(() => CreateLanguageEngagementOutput, {
    description: 'Create a language engagement',
  })
  async createLanguageEngagement(
    @Args('input')
    { engagement: input, changeset }: CreateLanguageEngagementInput,
  ): Promise<CreateLanguageEngagementOutput> {
    const engagement = await this.service.createLanguageEngagement(
      input,
      changeset,
    );
    return { engagement };
  }

  @Mutation(() => CreateInternshipEngagementOutput, {
    description: 'Create an internship engagement',
  })
  async createInternshipEngagement(
    @Args('input')
    { engagement: input, changeset }: CreateInternshipEngagementInput,
  ): Promise<CreateInternshipEngagementOutput> {
    const engagement = await this.service.createInternshipEngagement(
      input,
      changeset,
    );
    return { engagement };
  }

  @Mutation(() => UpdateLanguageEngagementOutput, {
    description: 'Update a language engagement',
  })
  async updateLanguageEngagement(
    @Args('input')
    { engagement: input, changeset }: UpdateLanguageEngagementInput,
  ): Promise<UpdateLanguageEngagementOutput> {
    const engagement = await this.service.updateLanguageEngagement(
      input,
      changeset,
    );
    return { engagement };
  }

  @Mutation(() => UpdateInternshipEngagementOutput, {
    description: 'Update an internship engagement',
  })
  async updateInternshipEngagement(
    @Args('input')
    { engagement: input, changeset }: UpdateInternshipEngagementInput,
  ): Promise<UpdateInternshipEngagementOutput> {
    const engagement = await this.service.updateInternshipEngagement(
      input,
      changeset,
    );
    return { engagement };
  }

  @Mutation(() => DeleteEngagementOutput, {
    description: 'Delete an engagement',
  })
  async deleteEngagement(
    @Args() { id, changeset }: ChangesetIds,
  ): Promise<DeleteEngagementOutput> {
    await this.service.delete(id, changeset);
    return { success: true };
  }
}
