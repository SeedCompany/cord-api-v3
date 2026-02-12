import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { from, map, merge, mergeMap } from 'rxjs';
import { omitNotFound$, Subscription } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { ResourceLoader } from '~/core/resources';
import {
  Language,
  LanguageCreated,
  LanguageDeleted,
  LanguageMutation,
  LanguageMutationOrDeletion,
  LanguageUpdated,
} from './dto';
import {
  LanguageChannels,
  LanguageCreatedArgs,
  LanguageMutationArgs,
  type LanguageMutationPayload,
} from './language.channels';
import { LanguageLoader } from './language.loader';

@Resolver(LanguageMutation)
export class LanguageMutationSubscriptionsResolver {
  constructor(
    private readonly channels: LanguageChannels,
    private readonly loaders: ResourceLoader,
  ) {}

  private verifyReadPermission$() {
    return mergeMap(
      <Payload extends LanguageMutationPayload>(payload: Payload) => {
        // Omit event if the user watching doesn't have permission to view the language
        return from(this.loaders.load('Language', payload.language)).pipe(
          omitNotFound$(),
          map(() => payload),
        );
      },
    );
  }

  @Subscription(() => LanguageCreated)
  languageCreated(@Args() args: LanguageCreatedArgs) {
    return this.channels.created(args).pipe(
      this.verifyReadPermission$(),
      map(
        ({ language, ...rest }): LanguageCreated => ({
          __typename: 'LanguageCreated',
          languageId: language,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => LanguageUpdated)
  languageUpdated(@Args() args: LanguageMutationArgs) {
    return this.channels.updated(args).pipe(
      this.verifyReadPermission$(),
      map(
        ({ language, ...rest }): LanguageUpdated => ({
          __typename: 'LanguageUpdated',
          languageId: language,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => LanguageDeleted)
  languageDeleted(@Args() args: LanguageMutationArgs) {
    return this.channels.deleted(args).pipe(
      // Cannot read a deleted record.
      // It is ok IMO to expose an ID that cannot be read anymore.
      // this.verifyReadPermission$(),
      map(
        ({ language, ...rest }): LanguageDeleted => ({
          __typename: 'LanguageDeleted',
          languageId: language,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => LanguageMutationOrDeletion, {
    description: 'Subscribe to any mutations of language(s)',
  })
  languageMutations(@Args() args: LanguageMutationArgs) {
    return merge(
      this.languageCreated(args),
      this.languageUpdated(args),
      this.languageDeleted(args),
    );
  }

  @ResolveField(() => Language)
  async language(
    @Parent() change: LanguageMutation,
    @Loader(LanguageLoader) languages: LoaderOf<LanguageLoader>,
  ): Promise<Language> {
    return await languages.load({
      id: change.languageId,
      view: { active: true },
    });
  }
}
