import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { PaginationInput } from '../../../common';
import { GqlSearchType, SearchResult, SearchType } from './search-results.dto';

@InputType()
export class SearchInput extends PaginationInput {
  static defaultVal = new SearchInput();

  @Field({
    description: 'The search string to look for.',
  })
  query: string;

  @Field(() => [GqlSearchType], {
    nullable: true,
    description: 'Limit results to one of these types',
  })
  type?: SearchType[];
}

@ObjectType()
export abstract class SearchOutput {
  @Field(() => [SearchResult], {
    description: 'The search string to look for.',
  })
  readonly items: SearchResult[];

  // skipping total, hasMore for now in-case it's hard to do.
}
