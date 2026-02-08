import { Args, Resolver } from '@nestjs/graphql';
import { from, map, merge, mergeMap, type ObservableInput } from 'rxjs';
import { omitNotFound$, Subscription } from '~/common';
import { Hooks, OnHook } from '~/core/hooks';
import { ResourceLoader } from '~/core/resources';
import { ObserveProjectMutationHook } from '../project/events';
import {
  EngagementCreated,
  EngagementDeleted,
  EngagementMutationOrDeletion,
  EngagementUpdated,
  InternshipEngagementCreated,
  InternshipEngagementDeleted,
  InternshipEngagementUpdated,
  LanguageEngagementCreated,
  LanguageEngagementDeleted,
  LanguageEngagementUpdated,
} from './dto';
import {
  EngagementChannels,
  EngagementCreatedArgs,
  EngagementMutationArgs,
  type EngagementMutationPayload,
} from './engagement.channels';
import { ObserveEngagementMutationHook } from './events/observe-engagement-mutation.hook';

@Resolver()
export class EngagementMutationSubscriptionsResolver {
  constructor(
    private readonly channels: EngagementChannels,
    private readonly loaders: ResourceLoader,
    private readonly hooks: Hooks,
  ) {}

  @OnHook(ObserveProjectMutationHook)
  async observeProjectChanges(hook: ObserveProjectMutationHook) {
    hook.add(await this.engagementMutations(hook.args));
  }

  private verifyReadPermission$() {
    return mergeMap(
      <Payload extends EngagementMutationPayload>(payload: Payload) => {
        // Omit event if the user watching doesn't have permission to view the engagement
        return from(this.loaders.load('Engagement', payload.engagement)).pipe(
          omitNotFound$(),
          map(() => payload),
        );
      },
    );
  }

  @Subscription(() => LanguageEngagementCreated)
  languageEngagementCreated(@Args() args: EngagementCreatedArgs) {
    return this.channels.languageCreated(args).pipe(
      this.verifyReadPermission$(),
      map(
        ({ project, engagement, ...rest }): LanguageEngagementCreated => ({
          __typename: 'LanguageEngagementCreated',
          projectId: project,
          engagementId: engagement,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => InternshipEngagementCreated)
  internshipEngagementCreated(@Args() args: EngagementCreatedArgs) {
    return this.channels.internshipCreated(args).pipe(
      this.verifyReadPermission$(),
      map(
        ({ project, engagement, ...rest }): InternshipEngagementCreated => ({
          __typename: 'InternshipEngagementCreated',
          projectId: project,
          engagementId: engagement,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => EngagementCreated)
  engagementCreated(@Args() args: EngagementCreatedArgs) {
    return merge(
      this.languageEngagementCreated(args),
      this.internshipEngagementCreated(args),
    );
  }

  @Subscription(() => LanguageEngagementUpdated)
  languageEngagementUpdated(@Args() args: EngagementMutationArgs) {
    return this.channels.languageUpdated(args).pipe(
      this.verifyReadPermission$(),
      map(
        ({ project, engagement, ...rest }): LanguageEngagementUpdated => ({
          __typename: 'LanguageEngagementUpdated',
          projectId: project,
          engagementId: engagement,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => InternshipEngagementUpdated)
  internshipEngagementUpdated(@Args() args: EngagementMutationArgs) {
    return this.channels.internshipUpdated(args).pipe(
      this.verifyReadPermission$(),
      map(
        ({ project, engagement, ...rest }): InternshipEngagementUpdated => ({
          __typename: 'InternshipEngagementUpdated',
          projectId: project,
          engagementId: engagement,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => EngagementUpdated)
  engagementUpdated(@Args() args: EngagementMutationArgs) {
    return merge(
      this.languageEngagementUpdated(args),
      this.internshipEngagementUpdated(args),
    );
  }

  @Subscription(() => LanguageEngagementDeleted)
  languageEngagementDeleted(@Args() args: EngagementMutationArgs) {
    return this.channels.languageDeleted(args).pipe(
      map(
        ({ project, engagement, ...rest }): LanguageEngagementDeleted => ({
          __typename: 'LanguageEngagementDeleted',
          projectId: project,
          engagementId: engagement,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => InternshipEngagementDeleted)
  internshipEngagementDeleted(@Args() args: EngagementMutationArgs) {
    return this.channels.internshipDeleted(args).pipe(
      map(
        ({ project, engagement, ...rest }): InternshipEngagementDeleted => ({
          __typename: 'InternshipEngagementDeleted',
          projectId: project,
          engagementId: engagement,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => EngagementDeleted)
  engagementDeleted(@Args() args: EngagementMutationArgs) {
    return merge(
      this.languageEngagementDeleted(args),
      this.internshipEngagementDeleted(args),
    );
  }

  @Subscription(() => EngagementMutationOrDeletion, {
    description: 'Subscribe to any mutations of engagement(s)',
  })
  async engagementMutations(@Args() args: EngagementMutationArgs) {
    const channels = new Set<ObservableInput<EngagementMutationOrDeletion>>([
      this.engagementCreated(args),
      this.engagementUpdated(args),
      this.engagementDeleted(args),
    ]);
    await this.hooks.run(new ObserveEngagementMutationHook(args, channels));
    return merge(...channels);
  }
}
