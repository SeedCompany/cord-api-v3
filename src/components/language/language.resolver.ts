import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, Token } from '../../common';
import {
  Language,
  LanguageListInput,
  LanguageListOutput,
  CreateLanguageOutput,
  CreateLanguageInput,
  UpdateLanguageOutput,
  UpdateLanguageInput,
} from './dto';
import { LanguageService } from './language.service';

@Resolver()
export class LanguageResolver {
  constructor(private readonly langService: LanguageService) {}

  @Query(() => Language, {
    description: 'Look up a language by its ID',
  })
  async language(
    @Token() token: string,
    @IdArg() id: string,
  ): Promise<Language> {
    return await this.langService.readOne(id, token);
  }

  @Query(() => LanguageListOutput, {
    description: 'Look up languages',
  })
  async languages(
    @Token() token: string,
    @Args({
      name: 'input',
      type: () => LanguageListInput,
      defaultValue: LanguageListInput.defaultVal,
    })
    input: LanguageListInput,
  ): Promise<LanguageListOutput> {
    return this.langService.list(input, token);
  }

  @Mutation(() => CreateLanguageOutput, {
    description: 'Create a language',
  })
  async createLanguage(
    @Token() token: string,
    @Args('input') { language: input }: CreateLanguageInput,
  ): Promise<CreateLanguageOutput> {
    const language = await this.langService.create(input, token);
    return { language };
  }

  @Mutation(() => UpdateLanguageOutput, {
    description: 'Update a language',
  })
  async updateLanguage(
    @Token() token: string,
    @Args('input') { language: input }: UpdateLanguageInput,
  ): Promise<UpdateLanguageOutput> {
    const language = await this.langService.update(input, token);
    return { language };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a language',
  })
  async deleteLanguage(
    @Token() token: string,
    @IdArg() id: string,
  ): Promise<boolean> {
    await this.langService.delete(id, token);
    return true;
  }
}
