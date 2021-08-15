import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  ID,
  IdArg,
  LoggedInSession,
  NotImplementedException,
  Session,
} from '../../common';
import { PinnedListInput, PinnedListOutput } from './dto';
import { FlagService } from './flag.service';

@Resolver()
export class FlagResolver {
  constructor(readonly pins: FlagService) {}

  @Query(() => Boolean, {
    description:
      'Returns whether or not the requesting user has pinned the resource ID',
  })
  async isPinned(
    @LoggedInSession() session: Session,
    @IdArg({
      description: 'A resource ID',
    })
    id: ID
  ): Promise<boolean> {
    return await this.pins.isPinned(id);
  }

  @Mutation(() => Boolean, {
    description:
      'Toggles the pinned state for the resource ID for the requesting user',
  })
  async toggleFlagged(
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
    pinned?: boolean
  ): Promise<boolean> {
    return await this.pins.toggleFlagged(id, pinned);
  }

  // @Query(() => PinnedListOutput, {
  //   name: 'pins',
  //   description: "A list of the requesting user's pinned items",
  // })
  async list(
    @LoggedInSession() _session: Session,
    @Args({
      name: 'input',
      type: () => PinnedListInput,
      defaultValue: PinnedListInput.defaultVal,
    })
    _input: PinnedListInput
  ): Promise<PinnedListOutput> {
    throw new NotImplementedException();
  }
}
