import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, LoaderOf } from '../../core';
import { EngagementLoader, LanguageEngagement } from '../engagement';
import { InternalFirstScripture } from './dto';

@Resolver(InternalFirstScripture)
export class InternalFirstScriptureResolver {
  @ResolveField(() => LanguageEngagement, {
    description: 'The engagement that produced the first scripture',
  })
  engagement(
    @Parent() { engagement }: InternalFirstScripture,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>
  ) {
    return engagements.load({
      id: engagement,
      view: { active: true },
    });
  }
}
