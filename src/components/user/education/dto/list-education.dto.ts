import { InputType, ObjectType } from 'type-graphql';
import {
  Order,
  SecuredList,
  SortablePaginationInput,
} from '../../../../common';
import { Education } from './education.dto';

@InputType()
export class EducationListInput extends SortablePaginationInput<
  keyof Education
>({
  defaultSort: 'institution',
}) {
  static defaultVal = new EducationListInput();
}

@ObjectType({
  description: SecuredList.descriptionFor('education objects'),
})
export abstract class SecuredEducationList extends SecuredList(
  Education,
) {}
