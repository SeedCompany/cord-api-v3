import {
  Args,
  ArgsType,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import {
  AnonSession,
  firstLettersOfWords,
  ID,
  IdArg,
  IdField,
  ListArg,
  LoggedInSession,
  SecuredDate,
  SecuredInt,
  Session,
  viewOfChangeset,
} from '../../common';
import { Loader, LoaderOf } from '../../core';
import { IdsAndView, IdsAndViewArg } from '../changeset/dto';
import { LocationListInput, SecuredLocationList } from '../location';
import { LocationLoader } from '../location/location.loader';
import { ProjectLoader, SecuredTranslationProjectList } from '../project';
import { ProjectListInput, SecuredProjectList } from '../project/dto';
import {
  CreateLanguageInput,
  CreateLanguageOutput,
  DeleteLanguageOutput,
  Language,
  LanguageListInput,
  LanguageListOutput,
  SecuredFirstScripture,
  UpdateLanguageInput,
  UpdateLanguageOutput,
} from './dto';
import { LanguageLoader } from './language.loader';
import { LanguageService } from './language.service';

@ArgsType()
class ModifyLocationArgs {
  @IdField()
  languageId: ID;

  @IdField()
  locationId: ID;
}

@Resolver(Language)
export class LanguageResolver {
  constructor(private readonly langService: LanguageService) {}

  @Query(() => Language, {
    description: 'Look up a language by its ID',
  })
  async language(
    @IdsAndViewArg() key: IdsAndView,
    @Loader(LanguageLoader) languages: LoaderOf<LanguageLoader>
  ): Promise<Language> {
    return await languages.load(key);
  }

  @ResolveField(() => String, { nullable: true })
  avatarLetters(@Parent() language: Language): string | undefined {
    return language.name.canRead && language.name.value
      ? firstLettersOfWords(language.name.value)
      : undefined;
  }

  @ResolveField(() => SecuredInt, {
    description: stripIndent`
      The language's population.
      This is either the \`populationOverride\` if defined
      or the ethnologue population as a fallback.
    `,
  })
  population(@Parent() language: Language): SecuredInt {
    // Only check this prop so we don't return different numbers based on
    // authorization. This seems the most sane, but could double check with business.
    const { canRead, value } = language.populationOverride;
    return {
      canEdit: false, // this is a computed field
      canRead,
      value: canRead
        ? value ?? language.ethnologue.population.value
        : undefined,
    };
  }

  @ResolveField()
  firstScripture(@Parent() language: Language): SecuredFirstScripture {
    if (!language.hasExternalFirstScripture.canRead) {
      return { canRead: false, canEdit: false };
    }
    const value = language.firstScriptureEngagement
      ? { hasFirst: true, engagement: language.firstScriptureEngagement }
      : { hasFirst: language.hasExternalFirstScripture.value! };
    return { canRead: true, canEdit: false, value };
  }

  @ResolveField(() => SecuredLocationList)
  async locations(
    @AnonSession() session: Session,
    @Parent() language: Language,
    @ListArg(LocationListInput) input: LocationListInput,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>
  ): Promise<SecuredLocationList> {
    const list = await this.langService.listLocations(language, input, session);
    locations.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredDate, {
    description: 'The earliest start date from its engagements.',
  })
  async sponsorStartDate(
    @AnonSession() session: Session,
    @Parent() language: Language
  ): Promise<SecuredDate> {
    return await this.langService.sponsorStartDate(language, session);
  }

  @ResolveField(() => SecuredTranslationProjectList, {
    description: 'The list of projects the language is engagement in.',
  })
  async projects(
    @AnonSession() session: Session,
    @Parent() language: Language,
    @ListArg(ProjectListInput) input: ProjectListInput,
    @Loader(ProjectLoader) loader: LoaderOf<ProjectLoader>
  ): Promise<SecuredProjectList> {
    const list = await this.langService.listProjects(language, input, session);
    loader.primeAll(list.items);
    return list;
  }

  @Query(() => LanguageListOutput, {
    description: 'Look up languages',
  })
  async languages(
    @AnonSession() session: Session,
    @ListArg(LanguageListInput) input: LanguageListInput,
    @Loader(LanguageLoader) languages: LoaderOf<LanguageLoader>
  ): Promise<LanguageListOutput> {
    const list = await this.langService.list(input, session);
    languages.primeAll(list.items);
    return list;
  }

  @Mutation(() => CreateLanguageOutput, {
    description: 'Create a language',
  })
  async createLanguage(
    @LoggedInSession() session: Session,
    @Args('input') { language: input }: CreateLanguageInput
  ): Promise<CreateLanguageOutput> {
    const language = await this.langService.create(input, session);
    return { language };
  }

  @Mutation(() => UpdateLanguageOutput, {
    description: 'Update a language',
  })
  async updateLanguage(
    @LoggedInSession() session: Session,
    @Args('input') { language: input, changeset }: UpdateLanguageInput
  ): Promise<UpdateLanguageOutput> {
    const language = await this.langService.update(
      input,
      session,
      viewOfChangeset(changeset)
    );
    return { language };
  }

  @Mutation(() => DeleteLanguageOutput, {
    description: 'Delete a language',
  })
  async deleteLanguage(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<DeleteLanguageOutput> {
    await this.langService.delete(id, session);
    return { success: true };
  }

  @Mutation(() => Language, {
    description: 'Add a location to a language',
  })
  async addLocationToLanguage(
    @LoggedInSession() session: Session,
    @Args() { languageId, locationId }: ModifyLocationArgs
  ): Promise<Language> {
    await this.langService.addLocation(languageId, locationId, session);
    return await this.langService.readOne(languageId, session);
  }

  @Mutation(() => Language, {
    description: 'Remove a location from a language',
  })
  async removeLocationFromLanguage(
    @LoggedInSession() session: Session,
    @Args() { languageId, locationId }: ModifyLocationArgs
  ): Promise<Language> {
    await this.langService.removeLocation(languageId, locationId, session);
    return await this.langService.readOne(languageId, session);
  }
}
