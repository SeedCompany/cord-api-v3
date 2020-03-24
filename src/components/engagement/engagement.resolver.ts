import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
import {
  CreateInternshipEngagementInput,
  CreateInternshipEngagementOutput,
  CreateLanguageEngagementInput,
  CreateLanguageEngagementOutput,
  Engagement,
  EngagementListInput,
  EngagementListOutput,
  IEngagement,
  InternshipEngagement,
  LanguageEngagement,
  UpdateInternshipEngagementInput,
  UpdateInternshipEngagementOutput,
  UpdateLanguageEngagementInput,
  UpdateLanguageEngagementOutput,
} from './dto';
import { EngagementService } from './engagement.service';

@Resolver()
export class EngagementResolver {
  constructor(private readonly service: EngagementService) {}

  @Query(() => IEngagement, {
    description: 'Lookup an engagement by ID',
  })
  async engagement(
    @IdArg() id: string,
    @Session() session: ISession
  ): Promise<Engagement> {
    return await this.service.readOne(id, session);
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
    @Session() session: ISession
  ): Promise<EngagementListOutput> {
    return this.service.list(input, session);
  }

  @Mutation(() => LanguageEngagement, {
    description: 'Create a language engagement',
  })
  async createLanguageEngagement(
    @Args('input') { engagement: input }: CreateLanguageEngagementInput,
    @Session() session: ISession
  ): Promise<CreateLanguageEngagementOutput> {
    const engagement = await this.service.createLanguageEngagement(
      input,
      session
    );
    return { engagement };
  }

  @Mutation(() => InternshipEngagement, {
    description: 'Create an internship engagement',
  })
  async createInternshipEngagement(
    @Args('input') { engagement: input }: CreateInternshipEngagementInput,
    @Session() session: ISession
  ): Promise<CreateInternshipEngagementOutput> {
    const engagement = await this.service.createInternshipEngagement(
      input,
      session
    );
    return { engagement };
  }

  @Mutation(() => LanguageEngagement, {
    description: 'Update a language engagement',
  })
  async updateLanguageEngagement(
    @Args('input') { engagement: input }: UpdateLanguageEngagementInput,
    @Session() session: ISession
  ): Promise<UpdateLanguageEngagementOutput> {
    const engagement = await this.service.updateLanguageEngagement(
      input,
      session
    );
    return { engagement };
  }

  @Mutation(() => InternshipEngagement, {
    description: 'Update an internship engagement',
  })
  async updateInternshipEngagement(
    @Args('input') { engagement: input }: UpdateInternshipEngagementInput,
    @Session() session: ISession
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
    @IdArg() id: string,
    @Session() session: ISession
  ): Promise<boolean> {
    await this.service.delete(id, session);
    return true;
  }
}
