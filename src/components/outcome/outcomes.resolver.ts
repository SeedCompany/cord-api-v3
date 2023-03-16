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

@Resolver(Outcome)
export class OutcomesResolver {
  @Mutation(() => Outcome, {
    description: 'Create a new outcome',
  })
  async createOutcome(@Args('input') input: CreateOutcomeInput) {
    throw new NotImplementedException('createOutcome').with(input);
  }

  @Mutation(() => Outcome, {
    description: 'Update an existing outcome',
  })
  async updateOutcome(@Args('input') { id, ...input }: UpdateOutcomeInput) {
    throw new NotImplementedException('updateOutcome').with(id, input);
  }

  @Mutation(() => Outcome, {
    description: stripIndent`
      Update the history of an outcome. It can assign a new report or
      change the value of the outcome or update the status of the outcome
    `,
  })
  async updateOutcomeHistory(@Args('input') input: UpdateOutcomeHistoryInput) {
    throw new NotImplementedException('updateOutcomeHistory').with(input);
  }

  @Mutation(() => Outcome, {
    description: 'Delete an outcome',
  })
  async deleteOutcome(@Args('id') id: ID) {
    throw new NotImplementedException('deleteOutcome').with(id);
  }

  @ResolveField(() => [OutcomeHistory])
  async history() {
    throw new NotImplementedException('history');
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
