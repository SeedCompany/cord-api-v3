import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { LoggedInSession, Session } from '../../common';
import { Changeable, PlanChange } from './dto';
import { PlanChangeService } from './plan-change.service';

@Resolver(Changeable)
export class ChangeableResolver {
  constructor(private readonly service: PlanChangeService) {}

  @ResolveField(() => PlanChange, {
    description: 'The current change plan/object that this object is for.',
    nullable: true,
  })
  async change(
    @Parent() object: Changeable,
    @LoggedInSession() session: Session
  ): Promise<PlanChange | null> {
    return object.changeId
      ? await this.service.readOne(object.changeId, session)
      : null;
  }
}
