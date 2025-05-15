import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  AnonSession,
  type ID,
  IdArg,
  ListArg,
  LoggedInSession,
  NotImplementedException,
  type Session,
} from '~/common';
import { PinnedListInput, type PinnedListOutput } from './dto';
import { PinService } from './pin.service';

@Resolver()
export class PinResolver {
  constructor(readonly pins: PinService) {}

  @Query(() => Boolean, {
    description:
      'Returns whether or not the requesting user has pinned the resource ID',
  })
  async isPinned(
    @AnonSession() session: Session,
    @IdArg({
      description: 'A resource ID',
    })
    id: ID,
  ): Promise<boolean> {
    // TODO move to DB layer?
    if (session.anonymous) {
      return false;
    }
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
    id: ID,
    @Args('pinned', {
      nullable: true,
      description:
        'Whether the item should be pinned or not. Omit to toggle the current state.',
    })
    pinned?: boolean,
  ): Promise<boolean> {
    return await this.pins.togglePinned(id, session, pinned);
  }

  // @Query(() => PinnedListOutput, {
  //   name: 'pins',
  //   description: "A list of the requesting user's pinned items",
  // })
  async list(
    @LoggedInSession() _session: Session,
    @ListArg(PinnedListInput) _input: PinnedListInput,
  ): Promise<PinnedListOutput> {
    throw new NotImplementedException();
  }
}
