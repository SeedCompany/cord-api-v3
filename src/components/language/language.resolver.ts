import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { firstLettersOfWords, IdArg, ISession, Session } from '../../common';
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

@Resolver(Language.classType)
export class LanguageResolver {
  constructor(private readonly langService: LanguageService) {}

  @Query(() => Language, {
    description: 'Look up a language by its ID',
  })
  async language(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<Language> {
    return this.langService.readOne(id, session);
  }

  @ResolveField(() => String, { nullable: true })
  avatarLetters(@Parent() language: Language): string | undefined {
    return language.name.canRead && language.name.value
      ? firstLettersOfWords(language.name.value)
      : undefined;
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

  @Query(() => Boolean, {
    description: 'Check language node consistency',
  })
  async checkLanguageConsistency(
    @Session() session: ISession
  ): Promise<boolean> {
    return this.langService.checkLanguageConsistency(session);
  }
}
