import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Language } from '../../model/language';
import { LanguageService } from './language.service';
import { 
    CreateLanguageInputDto, 
    CreateLanguageOutputDto,
    ReadLanguageInputDto,
    ReadLanguageOutputDto,
    UpdateLanguageInputDto,
    UpdateLanguageOutputDto,
    DeleteLanguageInputDto,
    DeleteLanguageOutputDto, 
} from './language.dto';


@Resolver(of => Language)
export class LanguageResolver {
    constructor(private readonly langService: LanguageService) {}

    @Mutation(returns => CreateLanguageOutputDto, {
        description: 'Create a language',
      })
      async createLanguage(
        @Args('input') { language: input }: CreateLanguageInputDto,
      ): Promise<CreateLanguageOutputDto> {
        return await this.langService.create(input);
      }
    
      @Query(returns => ReadLanguageOutputDto, {
        description: 'Read one language by id',
      })
      async readLanguage(
        @Args('input') { language: input }: ReadLanguageInputDto,
      ): Promise<ReadLanguageOutputDto> {
        return await this.langService.readOne(input);
      }
    
      @Mutation(returns => UpdateLanguageOutputDto, {
        description: 'Update a language',
      })
      async updateLanguage(
        @Args('input')
        { language: input }: UpdateLanguageInputDto,
      ): Promise<UpdateLanguageOutputDto> {
        return await this.langService.update(input);
      }
    
      @Mutation(returns => DeleteLanguageOutputDto, {
        description: 'Delete a language',
      })
      async deleteLanguage(
        @Args('input')
        { language: input }: DeleteLanguageInputDto,
      ): Promise<DeleteLanguageOutputDto> {
        return await this.langService.delete(input);
      }
    }