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
  InvalidIdForTypeException,
  ListArg,
  LoggedInSession,
  mapSecuredValue,
  SecuredDateRange,
  Session,
} from '~/common';
import { Loader, LoaderOf } from '~/core';
import { CeremonyLoader } from '../ceremony';
import { SecuredCeremony } from '../ceremony/dto';
import { ChangesetIds, IdsAndView, IdsAndViewArg } from '../changeset/dto';
import { EngagementLoader, EngagementService } from '../engagement';
import {
  CreateInternshipEngagementInput,
  CreateInternshipEngagementOutput,
  CreateLanguageEngagementInput,
  CreateLanguageEngagementOutput,
  DeleteEngagementOutput,
  Engagement,
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
    if (engagement.__typename !== 'LanguageEngagement') {
      throw new InvalidIdForTypeException();
    }
    return engagement;
  }

  @Query(() => EngagementListOutput, {
    description: 'Look up engagements',
  })
  async engagements(
    @ListArg(EngagementListInput) input: EngagementListInput,
    @AnonSession() session: Session,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>,
  ): Promise<EngagementListOutput> {
    const list = await this.service.list(input, session);
    engagements.primeAll(list.items);
    return list;
  }

  @Query(() => LanguageEngagementListOutput, {
    description: 'Look up language engagements',
  })
  async languageEngagements(
    @ListArg(EngagementListInput) input: EngagementListInput,
    @AnonSession() session: Session,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>,
  ): Promise<EngagementListOutput> {
    const list = await this.service.list(
      {
        ...input,
        filter: { ...input.filter, type: 'language' },
      },
      session,
    );
    engagements.primeAll(list.items);

    return list;
  }

  @ResolveField(() => SecuredCeremony)
  async ceremony(
    @Parent() engagement: Engagement,
    @Loader(CeremonyLoader) ceremonies: LoaderOf<CeremonyLoader>,
  ): Promise<SecuredCeremony> {
    return await mapSecuredValue(engagement.ceremony, (id) =>
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

  @Mutation(() => CreateLanguageEngagementOutput, {
    description: 'Create a language engagement',
  })
  async createLanguageEngagement(
    @Args('input')
    { engagement: input, changeset }: CreateLanguageEngagementInput,
    @LoggedInSession() session: Session,
  ): Promise<CreateLanguageEngagementOutput> {
    const engagement = await this.service.createLanguageEngagement(
      input,
      session,
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
    @LoggedInSession() session: Session,
  ): Promise<CreateInternshipEngagementOutput> {
    const engagement = await this.service.createInternshipEngagement(
      input,
      session,
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
    @LoggedInSession() session: Session,
  ): Promise<UpdateLanguageEngagementOutput> {
    const engagement = await this.service.updateLanguageEngagement(
      input,
      session,
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
    @LoggedInSession() session: Session,
  ): Promise<UpdateInternshipEngagementOutput> {
    const engagement = await this.service.updateInternshipEngagement(
      input,
      session,
      changeset,
    );
    return { engagement };
  }

  @Mutation(() => DeleteEngagementOutput, {
    description: 'Delete an engagement',
  })
  async deleteEngagement(
    @Args() { id, changeset }: ChangesetIds,
    @LoggedInSession() session: Session,
  ): Promise<DeleteEngagementOutput> {
    await this.service.delete(id, session, changeset);
    return { success: true };
  }
}
