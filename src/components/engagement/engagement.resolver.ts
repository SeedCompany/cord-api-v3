import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { DateTime } from 'luxon';
import {
  InvalidIdForTypeException,
  ListArg,
  mapSecuredValue,
  SecuredDateRange,
  viewOfChangeset,
} from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { Identity } from '~/core/authentication';
import { CeremonyLoader } from '../ceremony';
import { SecuredCeremony } from '../ceremony/dto';
import { ChangesetIds, type IdsAndView, IdsAndViewArg } from '../changeset/dto';
import { EngagementService } from '../engagement';
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
  resolveEngagementType,
  UpdateInternshipEngagement,
  UpdateLanguageEngagement,
} from './dto';
import { EngagementLoader } from './engagement.loader';

@Resolver(IEngagement)
export class EngagementResolver {
  constructor(
    private readonly service: EngagementService,
    private readonly identity: Identity,
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
    @Loader(EngagementLoader) loader: LoaderOf<EngagementLoader>,
  ): Promise<LanguageEngagementCreated> {
    const engagement = await this.service.createLanguageEngagement(
      input,
      changeset,
    );
    loader.prime(
      { id: engagement.id, view: viewOfChangeset(changeset) },
      engagement,
    );
    return {
      __typename: 'LanguageEngagementCreated',
      projectId: engagement.project.id,
      engagementId: engagement.id,
      at: engagement.createdAt,
      by: this.identity.current.userId,
    };
  }

  @Mutation(() => InternshipEngagementCreated, {
    description: 'Create an internship engagement',
  })
  async createInternshipEngagement(
    @Args('input') { changeset, ...input }: CreateInternshipEngagement,
    @Loader(EngagementLoader) loader: LoaderOf<EngagementLoader>,
  ): Promise<InternshipEngagementCreated> {
    const engagement = await this.service.createInternshipEngagement(
      input,
      changeset,
    );
    loader.prime(
      { id: engagement.id, view: viewOfChangeset(changeset) },
      engagement,
    );
    return {
      __typename: 'InternshipEngagementCreated',
      projectId: engagement.project.id,
      engagementId: engagement.id,
      at: engagement.createdAt,
      by: this.identity.current.userId,
    };
  }

  @Mutation(() => LanguageEngagementUpdated, {
    description: 'Update a language engagement',
  })
  async updateLanguageEngagement(
    @Args('input') { changeset, ...input }: UpdateLanguageEngagement,
    @Loader(EngagementLoader) loader: LoaderOf<EngagementLoader>,
  ): Promise<LanguageEngagementUpdated> {
    const {
      engagement,
      payload: { project: _, engagement: __, ...payload } = {
        previous: {},
        updated: {},
        at: DateTime.now(),
        by: this.identity.current.userId,
      },
    } = await this.service.updateLanguageEngagement(input, changeset);
    loader.prime(
      { id: engagement.id, view: viewOfChangeset(changeset) },
      engagement,
    );
    return {
      __typename: 'LanguageEngagementUpdated',
      projectId: engagement.project.id,
      engagementId: engagement.id,
      ...payload,
    };
  }

  @Mutation(() => InternshipEngagementUpdated, {
    description: 'Update an internship engagement',
  })
  async updateInternshipEngagement(
    @Args('input') { changeset, ...input }: UpdateInternshipEngagement,
    @Loader(EngagementLoader) loader: LoaderOf<EngagementLoader>,
  ): Promise<InternshipEngagementUpdated> {
    const {
      engagement,
      payload: { project: _, engagement: __, ...payload } = {
        previous: {},
        updated: {},
        at: DateTime.now(),
        by: this.identity.current.userId,
      },
    } = await this.service.updateInternshipEngagement(input, changeset);
    loader.prime(
      { id: engagement.id, view: viewOfChangeset(changeset) },
      engagement,
    );
    return {
      __typename: 'InternshipEngagementUpdated',
      projectId: engagement.project.id,
      engagementId: engagement.id,
      ...payload,
    };
  }

  @Mutation(() => EngagementDeleted, {
    description: 'Delete an engagement',
  })
  async deleteEngagement(
    @Args() { id, changeset }: ChangesetIds,
  ): Promise<EngagementDeleted> {
    const {
      engagement,
      payload: { project, engagement: _, ...payload },
    } = await this.service.delete(id, changeset);
    return {
      __typename:
        resolveEngagementType(engagement) === LanguageEngagement
          ? 'LanguageEngagementDeleted'
          : 'InternshipEngagementDeleted',
      projectId: project,
      engagementId: engagement.id,
      ...payload,
    };
  }
}
