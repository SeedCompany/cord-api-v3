import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import {
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../../common';
import { Education } from './education.dto';

@InputType()
export abstract class EducationFilters {
  @Field(() => ID, {
    description: 'Educations for UserId',
    nullable: true,
  })
  readonly userId?: string;
}

const defaultFilters = {};

@InputType()
export class EducationListInput extends SortablePaginationInput<
  keyof Education
>({
  defaultSort: 'institution',
}) {
  static defaultVal = new EducationListInput();

  @Field({ nullable: true })
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
