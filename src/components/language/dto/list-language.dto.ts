import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  type ID,
  OptionalField,
  PaginatedList,
  SecuredList,
  SensitivitiesFilterField,
  type Sensitivity,
  SortablePaginationInput,
} from '~/common';
import { Language } from './language.dto';

@InputType()
export abstract class EthnologueLanguageFilters {
  @OptionalField()
  readonly code?: string;

  @OptionalField()
  readonly provisionalCode?: string;

  @OptionalField()
  readonly name?: string;
}

@InputType()
export abstract class LanguageFilters {
  @OptionalField()
  readonly name?: string;

  @SensitivitiesFilterField()
  readonly sensitivity?: Sensitivity[];

  @OptionalField({
    description: 'Is a Least Of These partnership',
  })
  readonly leastOfThese?: boolean;

  @OptionalField()
  readonly isDialect?: boolean;

  @OptionalField()
  readonly isSignLanguage?: boolean;

  @OptionalField({
    description: 'Only languages that are (not) in the "Preset Inventory"',
  })
  readonly presetInventory?: boolean;

  @OptionalField({
    description:
      'Only languages that are pinned/unpinned by the requesting user',
  })
  readonly pinned?: boolean;

  @OptionalField({
    deprecationReason: 'Use `registryOfLanguageVarietiesCode` instead',
  })
  readonly registryOfDialectsCode?: string;

  @OptionalField()
  readonly registryOfLanguageVarietiesCode?: string;

  readonly partnerId?: ID;

  @FilterField(() => EthnologueLanguageFilters)
  readonly ethnologue?: EthnologueLanguageFilters & {};

  @OptionalField()
  readonly isAvailableForReporting?: boolean;
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
