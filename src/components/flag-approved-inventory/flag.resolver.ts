import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  ID,
  IdArg,
  LoggedInSession,
  NotImplementedException,
  Session,
} from '../../common';
import { FlaggedListInput, FlaggedListOutput } from './dto';
import { FlagService } from './flag.service';

@Resolver()
export class FlagResolver {
  constructor(readonly pins: FlagService) {}

  @Query(() => Boolean, {
    description:
      'Returns whether or not the requesting user has pinned the resource ID',
  })
  async isFlagged(
    @LoggedInSession() session: Session,
    @IdArg({
      description: 'A resource ID',
    })
    id: ID,
    approvedInventory: boolean
  ): Promise<boolean> {
    return await this.pins.isFlagged(id, approvedInventory);
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
    @Args('flagged', {
      nullable: true,
      description:
        'Whether the item should be pinned or not. Omit to toggle the current state.',
    })
    flagged?: boolean
  ): Promise<boolean> {
    return await this.pins.toggleFlagged(id, flagged);
  }

  // @Query(() => PinnedListOutput, {
  //   name: 'pins',
  //   description: "A list of the requesting user's pinned items",
  // })
  async list(
    @LoggedInSession() _session: Session,
    @Args({
      name: 'input',
      type: () => FlaggedListInput,
      defaultValue: FlaggedListInput.defaultVal,
    })
    _input: FlaggedListInput
  ): Promise<FlaggedListOutput> {
    throw new NotImplementedException();
  }
}
