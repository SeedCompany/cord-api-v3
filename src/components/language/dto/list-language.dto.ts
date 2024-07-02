import { Field, InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  ID,
  PaginatedList,
  SecuredList,
  SensitivitiesFilter,
  Sensitivity,
  SortablePaginationInput,
} from '~/common';
import { Language } from './language.dto';

@InputType()
export abstract class EthnologueLanguageFilters {
  @Field({
    nullable: true,
  })
  readonly code?: string;

  @Field({
    nullable: true,
  })
  readonly provisionalCode?: string;

  @Field({
    nullable: true,
  })
  readonly name?: string;
}

@InputType()
export abstract class LanguageFilters {
  @Field({
    nullable: true,
  })
  readonly name?: string;

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

  @Field({
    nullable: true,
  })
  readonly registryOfDialectsCode?: string;

  readonly partnerId?: ID;

  @FilterField(() => EthnologueLanguageFilters)
  readonly ethnologue?: EthnologueLanguageFilters & {};
}

@InputType()
export class LanguageListInput extends SortablePaginationInput<keyof Language>({
  defaultSort: 'name',
}) {
  @FilterField(() => LanguageFilters)
  readonly filter?: LanguageFilters;
}

@ObjectType()
export class LanguageListOutput extends PaginatedList(Language) {}

@ObjectType({
  description: SecuredList.descriptionFor('languages'),
})
export abstract class SecuredLanguageList extends SecuredList(Language) {}
