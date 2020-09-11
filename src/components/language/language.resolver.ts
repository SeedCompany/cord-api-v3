import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import {
  firstLettersOfWords,
  IdArg,
  ISession,
  SecuredInt,
  Session,
} from '../../common';
import { LocationListInput, SecuredLocationList } from '../location';
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

@Resolver(Language)
export class LanguageResolver {
  constructor(private readonly langService: LanguageService) {}

  @Query(() => Language, {
    description: 'Look up a language by its ID',
  })
  async language(
    @Session() session: ISession,
    @IdArg() id: string
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
    @Session() session: ISession,
    @Parent() language: Language,
    @Args({
      name: 'input',
      type: () => LocationListInput,
      defaultValue: LocationListInput.defaultVal,
    })
    input: LocationListInput
  ): Promise<SecuredLocationList> {
    return this.langService.listLocations(language, input, session);
  }

  @ResolveField(() => SecuredProjectList, {
    description: 'The list of projects the language is engagement in.',
  })
  async projects(
    @Session() session: ISession,
    @Parent() language: Language,
    @Args({
      name: 'input',
      type: () => ProjectListInput,
      defaultValue: ProjectListInput.defaultVal,
    })
    input: ProjectListInput
  ): Promise<SecuredProjectList> {
    return this.langService.listProjects(language, input, session);
  }

  @Query(() => LanguageListOutput, {
    description: 'Look up languages',
  })
  async languages(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => LanguageListInput,
      defaultValue: LanguageListInput.defaultVal,
    })
    input: LanguageListInput
  ): Promise<LanguageListOutput> {
    return this.langService.list(input, session);
  }

  @Mutation(() => CreateLanguageOutput, {
    description: 'Create a language',
  })
  async createLanguage(
    @Session() session: ISession,
    @Args('input') { language: input }: CreateLanguageInput
  ): Promise<CreateLanguageOutput> {
    const language = await this.langService.create(input, session);
    return { language };
  }

  @Mutation(() => UpdateLanguageOutput, {
    description: 'Update a language',
  })
  async updateLanguage(
    @Session() session: ISession,
    @Args('input') { language: input }: UpdateLanguageInput
  ): Promise<UpdateLanguageOutput> {
    const language = await this.langService.update(input, session);
    return { language };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a language',
  })
  async deleteLanguage(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.langService.delete(id, session);
    return true;
  }

  @Mutation(() => Language, {
    description: 'Add a location to a language',
  })
  async addLocationToLanguage(
    @Session() session: ISession,
    @Args('languageId', { type: () => ID }) languageId: string,
    @Args('locationId', { type: () => ID }) locationId: string
  ): Promise<Language> {
    await this.langService.addLocation(languageId, locationId, session);
    return this.langService.readOne(languageId, session);
  }

  @Mutation(() => Language, {
    description: 'Remove a location from a language',
  })
  async removeLocationFromLanguage(
    @Session() session: ISession,
    @Args('languageId', { type: () => ID }) languageId: string,
    @Args('locationId', { type: () => ID }) locationId: string
  ): Promise<Language> {
    await this.langService.removeLocation(languageId, locationId, session);
    return this.langService.readOne(languageId, session);
  }

  @Query(() => Boolean, {
    description: 'Check language node consistency',
  })
  async checkLanguageConsistency(
    @Session() session: ISession
  ): Promise<boolean> {
    return await this.langService.checkLanguageConsistency(session);
  }
}
