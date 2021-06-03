import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { AnonSession, ID, IdArg, LoggedInSession, Session } from '../../common';
import { CeremonyService, SecuredCeremony } from '../ceremony';
import {
  PeriodicReportListInput,
  PeriodicReportService,
  ReportType,
  SecuredPeriodicReport,
  SecuredPeriodicReportList,
} from '../periodic-report';
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
    private readonly ceremonies: CeremonyService,
    private readonly periodicReports: PeriodicReportService
  ) {}

  @Query(() => IEngagement, {
    description: 'Lookup an engagement by ID',
  })
  async engagement(
    @IdArg() id: ID,
    @AnonSession() session: Session
  ): Promise<Engagement> {
    const engagement = await this.service.readOne(id, session);
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

  @Mutation(() => CreateLanguageEngagementOutput, {
    description: 'Create a language engagement',
  })
  async createLanguageEngagement(
    @Args('input') { engagement: input }: CreateLanguageEngagementInput,
    @LoggedInSession() session: Session
  ): Promise<CreateLanguageEngagementOutput> {
    const engagement = await this.service.createLanguageEngagement(
      input,
      session
    );
    return { engagement };
  }

  @Mutation(() => CreateInternshipEngagementOutput, {
    description: 'Create an internship engagement',
  })
  async createInternshipEngagement(
    @Args('input') { engagement: input }: CreateInternshipEngagementInput,
    @LoggedInSession() session: Session
  ): Promise<CreateInternshipEngagementOutput> {
    const engagement = await this.service.createInternshipEngagement(
      input,
      session
    );
    return { engagement };
  }

  @Mutation(() => UpdateLanguageEngagementOutput, {
    description: 'Update a language engagement',
  })
  async updateLanguageEngagement(
    @Args('input') { engagement: input }: UpdateLanguageEngagementInput,
    @LoggedInSession() session: Session
  ): Promise<UpdateLanguageEngagementOutput> {
    const engagement = await this.service.updateLanguageEngagement(
      input,
      session
    );
    return { engagement };
  }

  @Mutation(() => UpdateInternshipEngagementOutput, {
    description: 'Update an internship engagement',
  })
  async updateInternshipEngagement(
    @Args('input') { engagement: input }: UpdateInternshipEngagementInput,
    @LoggedInSession() session: Session
  ): Promise<UpdateInternshipEngagementOutput> {
    const engagement = await this.service.updateInternshipEngagement(
      input,
      session
    );
    return { engagement };
  }

  @Mutation(() => Boolean, {
    description: 'Delete an engagement',
  })
  async deleteEngagement(
    @IdArg() id: ID,
    @LoggedInSession() session: Session
  ): Promise<boolean> {
    await this.service.delete(id, session);
    return true;
  }

  @ResolveField(() => SecuredPeriodicReportList)
  async progressReports(
    @AnonSession() session: Session,
    @Parent() engagement: Engagement,
    @Args({
      name: 'input',
      type: () => PeriodicReportListInput,
      defaultValue: PeriodicReportListInput.defaultVal,
    })
    input: PeriodicReportListInput
  ): Promise<SecuredPeriodicReportList> {
    return this.periodicReports.listEngagementReports(
      engagement.id,
      input,
      session
    );
  }

  @ResolveField(() => SecuredPeriodicReport)
  async dueProgressReport(
    @AnonSession() session: Session,
    @Parent() engagement: Engagement
  ): Promise<SecuredPeriodicReport> {
    const value = await this.periodicReports.getCurrentReport(
      engagement.id,
      ReportType.Progress,
      session
    );
    return {
      canEdit: true,
      canRead: true,
      value,
    };
  }
}
