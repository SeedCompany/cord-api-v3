import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { SecuredFloatNullable } from '../../common';
import { StepProgress } from './dto';

@Resolver(StepProgress)
export class StepProgressResolver {
  @ResolveField(() => SecuredFloatNullable, {
    deprecationReason: 'Use `StepProgress.completed` instead.',
  })
  percentDone(@Parent() { completed }: StepProgress) {
    return completed;
  }
}
