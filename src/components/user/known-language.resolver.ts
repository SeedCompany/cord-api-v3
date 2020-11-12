import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, Session } from '../../common';
import { Language, LanguageService } from '../language';
import { KnownLanguage } from './dto/known-language.dto';

@Resolver(KnownLanguage)
export class KnownLanguageResolver {
  constructor(private readonly languageService: LanguageService) {}

  @ResolveField(() => Language)
  async language(
    @Parent() knownLanguage: KnownLanguage,
    @AnonSession() session: Session
  ): Promise<Language> {
    const id = knownLanguage.language;
    return await this.languageService.readOne(id, session);
  }
}
