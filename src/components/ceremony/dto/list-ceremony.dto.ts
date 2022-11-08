import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { PaginatedList, SortablePaginationInput } from '../../../common';
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

const defaultFilters = {};

@InputType()
export class CeremonyListInput extends SortablePaginationInput<
  keyof Ceremony | 'projectName' | 'languageName'
>({
  defaultSort: 'projectName',
}) {
  @Field({ nullable: true })
  @Type(() => CeremonyFilters)
  @ValidateNested()
  readonly filter: CeremonyFilters = defaultFilters;
}

@ObjectType()
export class CeremonyListOutput extends PaginatedList(Ceremony) {}
