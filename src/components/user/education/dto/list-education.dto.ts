import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  ID,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { Education } from './education.dto';

@InputType()
export abstract class EducationFilters {
  readonly userId?: ID;
}

@InputType()
export class EducationListInput extends SortablePaginationInput<
  keyof Education
>({
  defaultSort: 'institution',
}) {
  @FilterField(() => EducationFilters, { internal: true })
  readonly filter?: EducationFilters;
}

@ObjectType()
export class EducationListOutput extends PaginatedList(Education) {}

@ObjectType({
  description: SecuredList.descriptionFor('education objects'),
})
export abstract class SecuredEducationList extends SecuredList(Education) {}
