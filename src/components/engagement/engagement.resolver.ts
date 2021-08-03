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
  LoggedInSession,
  SecuredDateRange,
  Session,
} from '../../common';
import { CeremonyService, SecuredCeremony } from '../ceremony';
import { ChangesetIds, IdsAndView, IdsAndViewArg } from '../changeset/dto';
import {
  CreateInternshipEngagementInput,
  CreateInternshipEngagementOutput,
  CreateLanguageEngagementInput,
  CreateLanguageEngagementOutput,
  Engagement,
  EngagementListInput,
  EngagementListOutput,
  IEngagement,
  UpdateInternshipEngagementInput,
  UpdateInternshipEngagementOutput,
  UpdateLanguageEngagementInput,
  UpdateLanguageEngagementOutput,
} from './dto';
import { EngagementService } from './engagement.service';

@Resolver(IEngagement)
export class EngagementResolver {
  constructor(
    private readonly service: EngagementService,
    private readonly ceremonies: CeremonyService
  ) {}

  @Query(() => IEngagement, {
    description: 'Lookup an engagement by ID',
  })
  async engagement(
    @IdsAndViewArg() { id, view }: IdsAndView,
    @AnonSession() session: Session
  ): Promise<Engagement> {
    const engagement = await this.service.readOne(id, session, view);
    return engagement;
  }

  @Query(() => EngagementListOutput, {
    description: 'Look up engagements',
  })
  async engagements(
    @Args({
      name: 'input',
      type: () => EngagementListInput,
      nullable: true,
      defaultValue: EngagementListInput.defaultVal,
    })
    input: EngagementListInput,
    @AnonSession() session: Session
  ): Promise<EngagementListOutput> {
    return await this.service.list(input, session);
  }

  @ResolveField(() => SecuredCeremony)
  async ceremony(
    @Parent() engagement: Engagement,
    @AnonSession() session: Session
  ): Promise<SecuredCeremony> {
    const { value: id, ...rest } = engagement.ceremony;
    const value = id ? await this.ceremonies.readOne(id, session) : undefined;
    return {
      value,
      ...rest,
    };
  }

  @ResolveField()
  dateRange(@Parent() engagement: Engagement): SecuredDateRange {
    return SecuredDateRange.fromPair(engagement.startDate, engagement.endDate);
  }

  @ResolveField()
  dateRangeOverride(@Parent() engagement: Engagement): SecuredDateRange {
    return SecuredDateRange.fromPair(
      engagement.startDateOverride,
      engagement.endDateOverride
    );
  }

  @Mutation(() => CreateLanguageEngagementOutput, {
    description: 'Create a language engagement',
  })
  async createLanguageEngagement(
    @Args('input')
    { engagement: input, changeset }: CreateLanguageEngagementInput,
    @LoggedInSession() session: Session
  ): Promise<CreateLanguageEngagementOutput> {
    const engagement = await this.service.createLanguageEngagement(
      input,
      session,
      changeset
    );
    return { engagement };
  }

  @Mutation(() => CreateInternshipEngagementOutput, {
    description: 'Create an internship engagement',
  })
  async createInternshipEngagement(
    @Args('input')
    { engagement: input, changeset }: CreateInternshipEngagementInput,
    @LoggedInSession() session: Session
  ): Promise<CreateInternshipEngagementOutput> {
    const engagement = await this.service.createInternshipEngagement(
      input,
      session,
      changeset
    );
    return { engagement };
  }

  @Mutation(() => UpdateLanguageEngagementOutput, {
    description: 'Update a language engagement',
  })
  async updateLanguageEngagement(
    @Args('input')
    { engagement: input, changeset }: UpdateLanguageEngagementInput,
    @LoggedInSession() session: Session
  ): Promise<UpdateLanguageEngagementOutput> {
    const engagement = await this.service.updateLanguageEngagement(
      input,
      session,
      changeset
    );
    return { engagement };
  }

  @Mutation(() => UpdateInternshipEngagementOutput, {
    description: 'Update an internship engagement',
  })
  async updateInternshipEngagement(
    @Args('input')
    { engagement: input, changeset }: UpdateInternshipEngagementInput,
    @LoggedInSession() session: Session
  ): Promise<UpdateInternshipEngagementOutput> {
    const engagement = await this.service.updateInternshipEngagement(
      input,
      session,
      changeset
    );
    return { engagement };
  }

  @Mutation(() => Boolean, {
    description: 'Delete an engagement',
  })
  async deleteEngagement(
    @Args() { id, changeset }: ChangesetIds,
    @LoggedInSession() session: Session
  ): Promise<boolean> {
    await this.service.delete(id, session, changeset);
    return true;
  }
}
