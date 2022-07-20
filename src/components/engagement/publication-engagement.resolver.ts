import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { mapSecuredValue, viewOfChangeset } from '../../common';
import { Loader, LoaderOf } from '../../core';
import { FileNodeLoader, resolveDefinedFile, SecuredFile } from '../file';
import { LanguageLoader, SecuredLanguage } from '../language';
import { PublicationEngagement } from './dto';
import { EngagementService } from './engagement.service';

@Resolver(PublicationEngagement)
export class PublicationEngagementResolver {
  constructor(private readonly engagements: EngagementService) {}

  @ResolveField(() => SecuredLanguage)
  async language(
    @Parent() engagement: PublicationEngagement,
    @Loader(LanguageLoader) languages: LoaderOf<LanguageLoader>
  ): Promise<SecuredLanguage> {
    return await mapSecuredValue(engagement.language, (id) =>
      languages.load({ id, view: viewOfChangeset(engagement.changeset) })
    );
  }

  @ResolveField(() => SecuredFile)
  async publicationPlan(
    @Parent() engagement: PublicationEngagement,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>
  ): Promise<SecuredFile> {
    return await resolveDefinedFile(files, engagement.publicationPlan);
  }
}
