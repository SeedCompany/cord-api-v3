import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { ID, NotImplementedException } from '~/common';
import { Outcome } from './dto';
import { CreateOutcomeInput } from './dto/create-outome.dto';
import { UpdateOutcomeInput } from './dto/update-outcome.dto';

@Resolver(Outcome)
export class OutcomesResolver {
  @Mutation(() => Outcome, {
    description: 'Create a new outcome',
  })
  async createOutcome(@Args('input') input: CreateOutcomeInput) {
    throw new NotImplementedException('createOutcome');
  }

  @Mutation(() => Outcome, {
    description: 'Update an existing outcome',
  })
  async updateOutcome(@Args('input') { id, ...input }: UpdateOutcomeInput) {
    throw new NotImplementedException('updateOutcome');
  }

  @Mutation(() => Outcome, {
    description: 'Delete an outcome',
  })
  async deleteOutcome(@Args('id') id: ID) {
    throw new NotImplementedException('deleteOutcome');
  }

  @Mutation(() => Outcome, {
    description:
      'Assign an outcome to a report. This will update the OutcomeHistory',
  })
  async assignToReport(@Args('input') { id, report }: UpdateOutcomeInput) {
    throw new NotImplementedException('moveToReport');
  }
}
