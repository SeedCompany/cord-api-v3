import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { from, map, merge, mergeMap } from 'rxjs';
import { omitNotFound$, Subscription } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { ResourceLoader } from '~/core/resources';
import {
  CeremonyChannels,
  CeremonyCreatedArgs,
  CeremonyMutationArgs,
  type CeremonyMutationPayload,
} from './ceremony.channels';
import { CeremonyLoader } from './ceremony.loader';
import {
  Ceremony,
  CeremonyCreated,
  CeremonyDeleted,
  CeremonyMutation,
  CeremonyMutationOrDeletion,
  CeremonyUpdated,
} from './dto';

@Resolver(CeremonyMutation)
export class CeremonyMutationSubscriptionsResolver {
  constructor(
    private readonly channels: CeremonyChannels,
    private readonly loaders: ResourceLoader,
  ) {}

  private verifyReadPermission$() {
    return mergeMap(
      <Payload extends CeremonyMutationPayload>(payload: Payload) => {
        // Omit event if the user watching doesn't have permission to view the ceremony
        return from(this.loaders.load('Ceremony', payload.ceremony)).pipe(
          omitNotFound$(),
          map(() => payload),
        );
      },
    );
  }

  @Subscription(() => CeremonyCreated)
  ceremonyCreated(@Args() args: CeremonyCreatedArgs) {
    return this.channels.created(args).pipe(
      this.verifyReadPermission$(),
      map(
        ({ ceremony, ...rest }): CeremonyCreated => ({
          __typename: 'CeremonyCreated',
          ceremonyId: ceremony,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => CeremonyUpdated)
  ceremonyUpdated(@Args() args: CeremonyMutationArgs) {
    return this.channels.updated(args).pipe(
      this.verifyReadPermission$(),
      map(
        ({ ceremony, ...rest }): CeremonyUpdated => ({
          __typename: 'CeremonyUpdated',
          ceremonyId: ceremony,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => CeremonyDeleted)
  ceremonyDeleted(@Args() args: CeremonyMutationArgs) {
    return this.channels.deleted(args).pipe(
      // Cannot read a deleted record.
      // It is ok IMO to expose an ID that cannot be read anymore.
      // this.verifyReadPermission$(),
      map(
        ({ ceremony, ...rest }): CeremonyDeleted => ({
          __typename: 'CeremonyDeleted',
          ceremonyId: ceremony,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => CeremonyMutationOrDeletion, {
    description: 'Subscribe to any mutations of ceremony(s)',
  })
  ceremonyMutations(@Args() args: CeremonyMutationArgs) {
    return merge(
      this.ceremonyCreated(args),
      this.ceremonyUpdated(args),
      this.ceremonyDeleted(args),
    );
  }

  @ResolveField(() => Ceremony)
  async ceremony(
    @Parent() change: CeremonyMutation,
    @Loader(CeremonyLoader) ceremonies: LoaderOf<CeremonyLoader>,
  ): Promise<Ceremony> {
    return await ceremonies.load(change.ceremonyId);
  }
}
