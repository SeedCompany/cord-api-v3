import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, LoaderOf } from '../../core';
import { Language, LanguageLoader } from '../language';
import { KnownLanguage } from './dto/known-language.dto';

@Resolver(KnownLanguage)
export class KnownLanguageResolver {
  @ResolveField(() => Language)
  async language(
    @Parent() knownLanguage: KnownLanguage,
    @Loader(LanguageLoader) languages: LoaderOf<LanguageLoader>,
  ): Promise<Language> {
    return await languages.load({
      id: knownLanguage.language,
      view: { active: true },
    });
  }
}
