import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { Identity } from '~/core/authentication';
import { CeremonyService } from '../ceremony';
import { CeremonyUpdated, UpdateCeremony } from './dto';

@Resolver()
export class CeremonyResolver {
  constructor(
    private readonly service: CeremonyService,
    private readonly identity: Identity,
  ) {}

  @Mutation(() => CeremonyUpdated, {
    description: 'Update a ceremony',
  })
  async updateCeremony(
    @Args('input') input: UpdateCeremony,
  ): Promise<CeremonyUpdated> {
    const {
      ceremony,
      payload = {
        updated: {},
        previous: {},
        at: DateTime.now(),
        by: this.identity.current.userId,
      },
    } = await this.service.update(input);
    return {
      __typename: 'CeremonyUpdated',
      ceremonyId: ceremony.id,
      ...payload,
    };
  }
}
