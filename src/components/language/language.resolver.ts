import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
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

@Resolver()
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
}
