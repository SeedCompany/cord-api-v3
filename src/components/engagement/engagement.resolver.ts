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
import {
  CreateInternshipEngagement,
  CreateLanguageEngagement,
  type Engagement,
  EngagementDeleted,
  EngagementListInput,
  EngagementListOutput,
  IEngagement,
  InternshipEngagement,
  InternshipEngagementCreated,
  InternshipEngagementListOutput,
  InternshipEngagementUpdated,
  LanguageEngagement,
  LanguageEngagementCreated,
  LanguageEngagementListOutput,
  LanguageEngagementUpdated,
  UpdateInternshipEngagement,
  UpdateLanguageEngagement,
} from './dto';

@Resolver(IEngagement)
export class EngagementResolver {
  constructor(private readonly service: EngagementService) {}

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

  @Query(() => InternshipEngagement, {
    description: 'Lookup an InternshipEngagement by ID',
  })
  async internshipEngagement(
    @IdsAndViewArg() key: IdsAndView,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>,
  ): Promise<Engagement> {
    const engagement = await engagements.load(key);
    if (InternshipEngagement.resolve(engagement) !== InternshipEngagement) {
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

  @Query(() => InternshipEngagementListOutput, {
    description: 'Look up internship engagements',
  })
  async internshipEngagements(
    @ListArg(EngagementListInput) input: EngagementListInput,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>,
  ): Promise<EngagementListOutput> {
    const list = await this.service.list({
      ...input,
      filter: { ...input.filter, type: 'internship' },
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

  @Mutation(() => LanguageEngagementCreated, {
    description: 'Create a language engagement',
  })
  async createLanguageEngagement(
    @Args('input') { changeset, ...input }: CreateLanguageEngagement,
  ): Promise<LanguageEngagementCreated> {
    const engagement = await this.service.createLanguageEngagement(
      input,
      changeset,
    );
    return { engagement };
  }

  @Mutation(() => InternshipEngagementCreated, {
    description: 'Create an internship engagement',
  })
  async createInternshipEngagement(
    @Args('input') { changeset, ...input }: CreateInternshipEngagement,
  ): Promise<InternshipEngagementCreated> {
    const engagement = await this.service.createInternshipEngagement(
      input,
      changeset,
    );
    return { engagement };
  }

  @Mutation(() => LanguageEngagementUpdated, {
    description: 'Update a language engagement',
  })
  async updateLanguageEngagement(
    @Args('input') { changeset, ...input }: UpdateLanguageEngagement,
  ): Promise<LanguageEngagementUpdated> {
    const engagement = await this.service.updateLanguageEngagement(
      input,
      changeset,
    );
    return { engagement };
  }

  @Mutation(() => InternshipEngagementUpdated, {
    description: 'Update an internship engagement',
  })
  async updateInternshipEngagement(
    @Args('input') { changeset, ...input }: UpdateInternshipEngagement,
  ): Promise<InternshipEngagementUpdated> {
    const engagement = await this.service.updateInternshipEngagement(
      input,
      changeset,
    );
    return { engagement };
  }

  @Mutation(() => EngagementDeleted, {
    description: 'Delete an engagement',
  })
  async deleteEngagement(
    @Args() { id, changeset }: ChangesetIds,
  ): Promise<EngagementDeleted> {
    await this.service.delete(id, changeset);
    return {};
  }
}
