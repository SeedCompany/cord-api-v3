import { Query, Resolver } from '@nestjs/graphql';
import { ListArg } from '~/common';
import { SearchInput, SearchOutput } from './dto';
import { SearchService } from './search.service';

@Resolver()
export class SearchResolver {
  constructor(private readonly service: SearchService) {}

  @Query(() => SearchOutput, {
    description: 'Perform a search across resources',
  })
  async search(
    @ListArg(SearchInput, { nullable: false })
    input: SearchInput,
  ): Promise<SearchOutput> {
    return await this.service.search(input);
  }
}
