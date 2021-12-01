import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  PaginatedList,
  SecuredList,
  SensitivitiesFilter,
  Sensitivity,
  SortablePaginationInput,
} from '../../../common';
import { Language } from './language.dto';

@InputType()
export abstract class LanguageFilters {
  @Field(() => [Sensitivity], {
    description: 'Only languages with these sensitivities',
    nullable: true,
  })
  @SensitivitiesFilter()
  readonly sensitivity?: Sensitivity[];

  @Field({
    nullable: true,
    description: 'Is a Least Of These partnership',
  })
  readonly leastOfThese?: boolean;

  @Field({
    nullable: true,
  })
  readonly isDialect?: boolean;

  @Field({
    nullable: true,
  })
  readonly isSignLanguage?: boolean;

  @Field({
    nullable: true,
    description: 'Only languages that are (not) in the "Preset Inventory"',
  })
  readonly presetInventory?: boolean;

  @Field({
    description:
      'Only languages that are pinned/unpinned by the requesting user',
    nullable: true,
  })
  readonly pinned?: boolean;
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
