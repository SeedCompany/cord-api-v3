import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, LoggedInSession, Session } from '../../common';
import { PinService } from './pin.service';

@Resolver()
export class PinResolver {
  constructor(readonly pins: PinService) {}

  @Query(() => Boolean, {
    description:
      'Returns whether or not the requesting user has pinned the resource ID',
  })
  async isPinned(
    @LoggedInSession() session: Session,
    @IdArg({
      description: 'A resource ID',
    })
    id: string
  ): Promise<boolean> {
    return await this.pins.isPinned(id, session);
  }

  @Mutation(() => Boolean, {
    description:
      'Toggles the pinned state for the resource ID for the requesting user',
  })
  async togglePinned(
    @LoggedInSession() session: Session,
    @IdArg({
      description: 'A resource ID',
    })
    id: string,
    @Args('pinned', {
      nullable: true,
      description:
        'Whether the item should be pinned or not. Omit to toggle the current state.',
    })
    pinned?: boolean
  ): Promise<boolean> {
    return await this.pins.togglePinned(id, session, pinned);
  }
}
