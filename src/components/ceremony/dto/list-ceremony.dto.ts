import { InputType } from '@nestjs/graphql';
import { FilterField, OptionalField, SortablePaginationInput } from '~/common';
import { CeremonyType } from './ceremony-type.enum';
import { type Ceremony } from './ceremony.dto';

@InputType()
export abstract class CeremonyFilters {
  @OptionalField(() => CeremonyType, {
    description: 'Only ceremonies of this type',
  })
  readonly type?: CeremonyType;
}

@InputType()
export class CeremonyListInput extends SortablePaginationInput<
  keyof Ceremony | 'projectName' | 'languageName'
>({
  defaultSort: 'projectName',
}) {
  @FilterField(() => CeremonyFilters)
  readonly filter?: CeremonyFilters;
}
