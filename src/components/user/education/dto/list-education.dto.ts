import { InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  ID,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../../common';
import { Education } from './education.dto';

@InputType()
export abstract class EducationFilters {
  readonly userId?: ID;
}

const defaultFilters = {};

@InputType()
export class EducationListInput extends SortablePaginationInput<
  keyof Education
>({
  defaultSort: 'institution',
}) {
  @Type(() => EducationFilters)
  @ValidateNested()
  readonly filter: EducationFilters = defaultFilters;
}

@ObjectType()
export class EducationListOutput extends PaginatedList(Education) {}

@ObjectType({
  description: SecuredList.descriptionFor('education objects'),
})
export abstract class SecuredEducationList extends SecuredList(Education) {}
