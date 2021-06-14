import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { LoggedInSession, Session } from '../../common';
import { ChangesetAware, PlanChange } from './dto';
import { PlanChangeService } from './plan-change.service';

@Resolver(ChangesetAware)
export class ChangesetAwareResolver {
  constructor(private readonly service: PlanChangeService) {}

  @ResolveField(() => PlanChange, {
    description: 'The current change plan/object that this object is for.',
    nullable: true,
  })
  async change(
    @Parent() object: ChangesetAware,
    @LoggedInSession() session: Session
  ): Promise<PlanChange | null> {
    return object.changeset
      ? await this.service.readOne(object.changeset, session)
      : null;
  }
}
