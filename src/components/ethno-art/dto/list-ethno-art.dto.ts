import { InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { PaginatedList, SortablePaginationInput } from '../../../common';
import { EthnoArt } from './ethno-art.dto';

@InputType()
export abstract class EthnoArtFilters {}

const defaultFilters = {};

@InputType()
export class EthnoArtListInput extends SortablePaginationInput<keyof EthnoArt>({
  defaultSort: 'name',
}) {
  @Type(() => EthnoArtFilters)
  @ValidateNested()
  readonly filter: EthnoArtFilters = defaultFilters;
}

@ObjectType()
export class EthnoArtListOutput extends PaginatedList(EthnoArt) {}
