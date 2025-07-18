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
  firstLettersOfWords,
  type ID,
  IdArg,
  IdField,
  ListArg,
  SecuredDate,
  SecuredIntNullable,
  SecuredStringNullable,
  viewOfChangeset,
} from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { type IdsAndView, IdsAndViewArg } from '../changeset/dto';
import { EngagementLoader } from '../engagement';
import { EngagementListInput, SecuredEngagementList } from '../engagement/dto';
import { LocationLoader } from '../location';
import { LocationListInput, SecuredLocationList } from '../location/dto';
import { ProjectLoader } from '../project';
import {
  ProjectListInput,
  type SecuredProjectList,
  SecuredTranslationProjectList,
} from '../project/dto';
import {
  CreateLanguageInput,
  CreateLanguageOutput,
  DeleteLanguageOutput,
  type ExternalFirstScripture,
  type InternalFirstScripture,
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
    @Loader(LanguageLoader) languages: LoaderOf<LanguageLoader>,
  ): Promise<Language> {
    return await languages.load(key);
  }

  @ResolveField(() => String, { nullable: true })
  avatarLetters(@Parent() language: Language): string | undefined {
    return language.name.canRead && language.name.value
      ? firstLettersOfWords(language.name.value)
      : undefined;
  }

  @ResolveField(() => SecuredIntNullable, {
    description: stripIndent`
      The language's population.
      This is either the \`populationOverride\` if defined
      or the ethnologue population as a fallback.
    `,
  })
  population(@Parent() language: Language): SecuredIntNullable {
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

  @ResolveField(() => SecuredStringNullable, {
    deprecationReason: 'Use `registryOfLanguageVarieties` instead',
  })
  registryOfDialectsCode(@Parent() language: Language): SecuredStringNullable {
    return language.registryOfLanguageVarietiesCode;
  }

  @ResolveField()
  firstScripture(@Parent() language: Language): SecuredFirstScripture {
    if (!language.hasExternalFirstScripture.canRead) {
      return { canRead: false, canEdit: false };
    }
    const value = language.firstScriptureEngagement
      ? ({
          hasFirst: true,
          engagement: language.firstScriptureEngagement.id,
        } satisfies InternalFirstScripture)
      : ({
          hasFirst: language.hasExternalFirstScripture.value!,
        } satisfies ExternalFirstScripture);
    return { canRead: true, canEdit: false, value };
  }

  @ResolveField(() => SecuredLocationList)
  async locations(
    @Parent() language: Language,
    @ListArg(LocationListInput) input: LocationListInput,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>,
  ): Promise<SecuredLocationList> {
    const list = await this.langService.listLocations(language, input);
    locations.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredDate, {
    description: 'The earliest start date from its engagements.',
  })
  async sponsorStartDate(@Parent() language: Language): Promise<SecuredDate> {
    return await this.langService.sponsorStartDate(language);
  }

  @ResolveField(() => SecuredTranslationProjectList, {
    description: 'The list of projects the language is engagement in.',
  })
  async projects(
    @Parent() language: Language,
    @ListArg(ProjectListInput) input: ProjectListInput,
    @Loader(ProjectLoader) loader: LoaderOf<ProjectLoader>,
  ): Promise<SecuredProjectList> {
    const list = await this.langService.listProjects(language, input);
    loader.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredEngagementList, {
    description: "The list of the language's engagements.",
  })
  async engagements(
    @Parent() language: Language,
    @ListArg(EngagementListInput) input: EngagementListInput,
    @Loader(EngagementLoader) loader: LoaderOf<EngagementLoader>,
  ): Promise<SecuredEngagementList> {
    const list = await this.langService.listEngagements(language, input);
    loader.primeAll(list.items);
    return list;
  }

  @Query(() => LanguageListOutput, {
    description: 'Look up languages',
  })
  async languages(
    @ListArg(LanguageListInput) input: LanguageListInput,
    @Loader(LanguageLoader) languages: LoaderOf<LanguageLoader>,
  ): Promise<LanguageListOutput> {
    const list = await this.langService.list(input);
    languages.primeAll(list.items);
    return list;
  }

  @Mutation(() => CreateLanguageOutput, {
    description: 'Create a language',
  })
  async createLanguage(
    @Args('input') { language: input }: CreateLanguageInput,
  ): Promise<CreateLanguageOutput> {
    const language = await this.langService.create(input);
    return { language };
  }

  @Mutation(() => UpdateLanguageOutput, {
    description: 'Update a language',
  })
  async updateLanguage(
    @Args('input') { language: input, changeset }: UpdateLanguageInput,
  ): Promise<UpdateLanguageOutput> {
    const language = await this.langService.update(
      input,
      viewOfChangeset(changeset),
    );
    return { language };
  }

  @Mutation(() => DeleteLanguageOutput, {
    description: 'Delete a language',
  })
  async deleteLanguage(@IdArg() id: ID): Promise<DeleteLanguageOutput> {
    await this.langService.delete(id);
    return { success: true };
  }

  @Mutation(() => Language, {
    description: 'Add a location to a language',
  })
  async addLocationToLanguage(
    @Args() { languageId, locationId }: ModifyLocationArgs,
  ): Promise<Language> {
    await this.langService.addLocation(languageId, locationId);
    return await this.langService.readOne(languageId);
  }

  @Mutation(() => Language, {
    description: 'Remove a location from a language',
  })
  async removeLocationFromLanguage(
    @Args() { languageId, locationId }: ModifyLocationArgs,
  ): Promise<Language> {
    await this.langService.removeLocation(languageId, locationId);
    return await this.langService.readOne(languageId);
  }
}
