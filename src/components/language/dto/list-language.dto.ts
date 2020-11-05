import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  PaginatedList,
  SecuredList,
  Sensitivity,
  SortablePaginationInput,
} from '../../../common';
import { Language } from './language.dto';

@InputType()
export abstract class LanguageFilters {
  @Field(() => [Sensitivity], {
    description: 'Only projects with these sensitivities',
    nullable: true,
  })
  readonly sensitivity?: Sensitivity[];
}

const defaultFilters = {};

@InputType()
export class LanguageListInput extends SortablePaginationInput<keyof Language>({
  defaultSort: 'name',
}) {
  static defaultVal = new LanguageListInput();

  @Field({ nullable: true })
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
