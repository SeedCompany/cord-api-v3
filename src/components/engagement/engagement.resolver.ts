import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { AnonSession, IdArg, LoggedInSession, Session } from '../../common';
import { CeremonyService, SecuredCeremony } from '../ceremony';
import {
  CreateInternshipEngagementInput,
  CreateInternshipEngagementOutput,
  CreateLanguageEngagementInput,
  CreateLanguageEngagementOutput,
  Engagement,
  EngagementConsistencyInput,
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
    @IdArg() id: string,
    @AnonSession() session: Session
  ): Promise<Engagement> {
    const engagement = await this.service.readOne(id, session);
    // @ts-expect-error hack engagement id into status object
    // so the lazy transitions field resolver can use it
    engagement.status.engagementId = engagement.id;
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
    const engagements = await this.service.list(input, session);
    await this.service.setEngagementIdsIntoStatusObjects(engagements);
    return engagements;
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
    // @ts-expect-error hack engagement id into status object
    // so the lazy transitions field resolver can use it
    engagement.status.engagementId = engagement.id;
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
    // @ts-expect-error hack engagement id into status object
    // so the lazy transitions field resolver can use it
    engagement.status.engagementId = engagement.id;
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
    // @ts-expect-error hack engagement id into status object
    // so the lazy transitions field resolver can use it
    engagement.status.engagementId = engagement.id;
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
    // @ts-expect-error hack engagement id into status object
    // so the lazy transitions field resolver can use it
    engagement.status.engagementId = engagement.id;
    return { engagement };
  }

  @Mutation(() => Boolean, {
    description: 'Delete an engagement',
  })
  async deleteEngagement(
    @IdArg() id: string,
    @LoggedInSession() session: Session
  ): Promise<boolean> {
    await this.service.delete(id, session);
    return true;
  }

  @Query(() => Boolean, {
    description: 'Check Consistency in Engagement Nodes',
  })
  async checkEngagementConsistency(
    @Args('input') input: EngagementConsistencyInput,
    @LoggedInSession() session: Session
  ): Promise<boolean> {
    return await this.service.checkEngagementConsistency(
      input.baseNode,
      session
    );
  }
}
