import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { LoggedInSession, Session } from '../../common';
import { Changeset, ChangesetAware } from './dto';
import { PlanChangeService } from './plan-change.service';

@Resolver(ChangesetAware)
export class ChangesetAwareResolver {
  constructor(private readonly service: PlanChangeService) {}

  @ResolveField(() => Changeset, {
    description: 'The current changeset that this object is for.',
    nullable: true,
  })
  async changeset(
    @Parent() object: ChangesetAware,
    @LoggedInSession() session: Session
  ): Promise<Changeset | null> {
    return object.changeset
      ? await this.service.readOne(object.changeset, session)
      : null;
  }
}
