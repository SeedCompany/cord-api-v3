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
  LoggedInSession,
  SecuredDate,
  SecuredInt,
  Session,
} from '../../common';
import { Loader, LoaderOf } from '../../core';
import { LocationListInput, SecuredLocationList } from '../location';
import { ProjectLoader } from '../project';
import { ProjectListInput, SecuredProjectList } from '../project/dto';
import {
  CreateLanguageInput,
  CreateLanguageOutput,
  Language,
  LanguageListInput,
  LanguageListOutput,
  UpdateLanguageInput,
  UpdateLanguageOutput,
} from './dto';
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
    @AnonSession() session: Session,
    @IdArg() id: ID
  ): Promise<Language> {
    return await this.langService.readOne(id, session);
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

  @ResolveField(() => SecuredLocationList)
  async locations(
    @AnonSession() session: Session,
    @Parent() language: Language,
    @Args({
      name: 'input',
      type: () => LocationListInput,
      defaultValue: LocationListInput.defaultVal,
    })
    input: LocationListInput
  ): Promise<SecuredLocationList> {
    return await this.langService.listLocations(language, input, session);
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

  @ResolveField(() => SecuredProjectList, {
    description: 'The list of projects the language is engagement in.',
  })
  async projects(
    @AnonSession() session: Session,
    @Parent() language: Language,
    @Args({
      name: 'input',
      type: () => ProjectListInput,
      defaultValue: ProjectListInput.defaultVal,
    })
    input: ProjectListInput,
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
    @Args({
      name: 'input',
      type: () => LanguageListInput,
      defaultValue: LanguageListInput.defaultVal,
    })
    input: LanguageListInput
  ): Promise<LanguageListOutput> {
    return await this.langService.list(input, session);
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
    @Args('input') { language: input }: UpdateLanguageInput
  ): Promise<UpdateLanguageOutput> {
    const language = await this.langService.update(input, session);
    return { language };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a language',
  })
  async deleteLanguage(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<boolean> {
    await this.langService.delete(id, session);
    return true;
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
