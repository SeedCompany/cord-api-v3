import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { type ID, IdArg, ListArg, NotImplementedException } from '~/common';
import { Identity } from '~/core/authentication';
import { PinnedListInput, type PinnedListOutput } from './dto';
import { PinService } from './pin.service';

@Resolver()
export class PinResolver {
  constructor(private readonly pins: PinService, private readonly identity: Identity) {}

  @Query(() => Boolean, {
    description: 'Returns whether or not the requesting user has pinned the resource ID',
  })
  async isPinned(
    @IdArg({
      description: 'A resource ID',
    })
    id: ID,
  ): Promise<boolean> {
    // TODO move to DB layer?
    if (this.identity.isAnonymous) {
      return false;
    }
    return await this.pins.isPinned(id);
  }

  @Mutation(() => Boolean, {
    description: 'Toggles the pinned state for the resource ID for the requesting user',
  })
  async togglePinned(
    @IdArg({
      description: 'A resource ID',
    })
    id: ID,
    @Args('pinned', {
      nullable: true,
      description: 'Whether the item should be pinned or not. Omit to toggle the current state.',
    })
    pinned?: boolean,
  ): Promise<boolean> {
    return await this.pins.togglePinned(id, pinned);
  }

  // @Query(() => PinnedListOutput, {
  //   name: 'pins',
  //   description: "A list of the requesting user's pinned items",
  // })
  async list(@ListArg(PinnedListInput) _input: PinnedListInput): Promise<PinnedListOutput> {
    throw new NotImplementedException();
  }
}
