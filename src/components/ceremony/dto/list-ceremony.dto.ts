import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { FilterField, PaginatedList, SortablePaginationInput } from '~/common';
import { Ceremony } from './ceremony.dto';
import { CeremonyType } from './type.enum';

@InputType()
export abstract class CeremonyFilters {
  @Field(() => CeremonyType, {
    description: 'Only ceremonies of this type',
    nullable: true,
  })
  readonly type?: CeremonyType;
}

@InputType()
export class CeremonyListInput extends SortablePaginationInput<
  keyof Ceremony | 'projectName' | 'languageName'
>({
  defaultSort: 'projectName',
}) {
  @FilterField(CeremonyFilters)
  readonly filter: CeremonyFilters;
}

@ObjectType()
export class CeremonyListOutput extends PaginatedList(Ceremony) {}
