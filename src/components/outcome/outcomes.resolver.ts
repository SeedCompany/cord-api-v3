import {
  Args,
  Info,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { Fields, ID, IsOnlyId, NotImplementedException } from '~/common';
import { Loader, LoaderOf } from '~/core';
import { LanguageEngagement } from '../engagement/dto';
import { EngagementLoader } from '../engagement/engagement.loader';
import { Outcome, OutcomeHistory } from './dto';
import { CreateOutcomeInput } from './dto/create-outome.dto';
import { UpdateOutcomeHistoryInput } from './dto/update-outcome-history.dto';
import { UpdateOutcomeInput } from './dto/update-outcome.dto';
import { OutcomesHistoryService } from './outcomes-history.service';
import { OutcomesService } from './outomes.service';

@Resolver(Outcome)
export class OutcomesResolver {
  constructor(
    private readonly service: OutcomesService,
    private readonly historyService: OutcomesHistoryService,
  ) {}

  @Mutation(() => Outcome, {
    description: 'Create a new outcome',
  })
  async createOutcome(@Args('input') input: CreateOutcomeInput) {
    const temp = await this.service.create(input);
    return temp;
  }

  @Mutation(() => Outcome, {
    description: 'Update an existing outcome',
  })
  async updateOutcome(@Args('input') { id, ...input }: UpdateOutcomeInput) {
    // TODO: implement updateOutcome
    throw new NotImplementedException('updateOutcome').with(id, input);
  }

  @Mutation(() => Outcome, {
    description: stripIndent`
      Update the history of an outcome. It can assign a new report or
      change the value of the outcome or update the status of the outcome
    `,
  })
  async updateOutcomeHistory(@Args('input') input: UpdateOutcomeHistoryInput) {
    return await this.historyService.updateOutcomeHistory(input);
  }

  @Mutation(() => Outcome, {
    description: 'Delete an outcome',
  })
  async deleteOutcome(@Args('id') id: ID) {
    // TODO: implement deleteOutcome
    throw new NotImplementedException('deleteOutcome').with(id);
  }

  @ResolveField(() => [OutcomeHistory])
  async history(@Parent() outcome: Outcome) {
    return await this.historyService.readByOutcomeId(outcome.id);
  }

  @ResolveField(() => LanguageEngagement)
  async engagement(
    @Parent() outcome: Outcome,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>,
    @Info(Fields, IsOnlyId) isOnlyId: boolean,
  ) {
    const node = {
      __typename: 'LanguageEngagement',
      id: outcome.engagement,
    } as const;

    if (isOnlyId) {
      return node;
    }

    return await engagements.load({
      id: outcome.engagement,
      view: { active: true },
    });
  }
}
