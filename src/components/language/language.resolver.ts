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


@Resolver('Language')
export class LanguageResolver {
    constructor(private readonly orgService: LanguageService) {}

    @Mutation(returns => CreateLanguageOutputDto, {
        description: 'Create an language',
      })
      async createLanguage(
        @Args('input') { language: input }: CreateLanguageInputDto,
      ): Promise<CreateLanguageOutputDto> {
        return await this.orgService.create(input);
      }
    
      @Query(returns => ReadLanguageOutputDto, {
        description: 'Read one language by id',
      })
      async readLanguage(
        @Args('input') { language: input }: ReadLanguageInputDto,
      ): Promise<ReadLanguageOutputDto> {
        return await this.orgService.readOne(input);
      }
    
      @Mutation(returns => UpdateLanguageOutputDto, {
        description: 'Update an language',
      })
      async updateLanguage(
        @Args('input')
        { language: input }: UpdateLanguageInputDto,
      ): Promise<UpdateLanguageOutputDto> {
        return await this.orgService.update(input);
      }
    
      @Mutation(returns => DeleteLanguageOutputDto, {
        description: 'Delete an language',
      })
      async deleteLanguage(
        @Args('input')
        { language: input }: DeleteLanguageInputDto,
      ): Promise<DeleteLanguageOutputDto> {
        return await this.orgService.delete(input);
      }
    }