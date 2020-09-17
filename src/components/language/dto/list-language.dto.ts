import { InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { Language } from './language.dto';

@InputType()
export abstract class LanguageFilters {}

const defaultFilters = {};

@InputType()
export class LanguageListInput extends SortablePaginationInput<keyof Language>({
  defaultSort: 'name',
}) {
  static defaultVal = new LanguageListInput();

  @Type(() => LanguageFilters)
  @ValidateNested()
  readonly filter: LanguageFilters = defaultFilters;
}

@ObjectType()
export class LanguageListOutput extends PaginatedList(Language) {}

@ObjectType({
  description: SecuredList.descriptionFor('languages'),
})
export abstract class SecuredLanguageList extends SecuredList(Language) {}
