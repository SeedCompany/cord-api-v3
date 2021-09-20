import { Args, Query, Resolver } from '@nestjs/graphql';
import { AnonSession, Session } from '../../common';
import { SearchInput, SearchOutput } from './dto';
import { SearchService } from './search.service';

@Resolver()
export class SearchResolver {
  constructor(private readonly service: SearchService) {}

  @Query(() => SearchOutput, {
    description: 'Perform a search across resources',
  })
  async search(
    @AnonSession() session: Session,
    @Args({
      name: 'input',
      type: () => SearchInput,
      defaultValue: SearchInput.defaultVal,
    })
    input: SearchInput
  ): Promise<SearchOutput> {
    return await this.service.search(input, session);
  }
}
