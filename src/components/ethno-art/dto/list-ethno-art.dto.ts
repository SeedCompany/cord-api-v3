import { InputType, ObjectType } from '@nestjs/graphql';
import { FilterField, PaginatedList, SortablePaginationInput } from '~/common';
import { EthnoArt } from './ethno-art.dto';

@InputType()
export abstract class EthnoArtFilters {}

@InputType()
export class EthnoArtListInput extends SortablePaginationInput<keyof EthnoArt>({
  defaultSort: 'name',
}) {
  @FilterField(() => EthnoArtFilters, { internal: true })
  readonly filter?: EthnoArtFilters;
}

@ObjectType()
export class EthnoArtListOutput extends PaginatedList(EthnoArt) {}
