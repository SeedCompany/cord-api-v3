import { Args, Query, Resolver } from '@nestjs/graphql';
import { ISession, Session } from '../../common';
import { SearchInput, SearchOutput } from './dto';
import { SearchService } from './search.service';

@Resolver()
export class SearchResolver {
  constructor(private readonly service: SearchService) {}

  @Query(() => SearchOutput, {
    description: 'Perform a search across resources',
  })
  async search(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => SearchInput,
      defaultValue: SearchInput.defaultVal,
    })
    input: SearchInput
  ): Promise<SearchOutput> {
    return this.service.search(input, session);
  }
}
