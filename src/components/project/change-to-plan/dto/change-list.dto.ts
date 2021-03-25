import { InputType, ObjectType } from '@nestjs/graphql';
import {
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../../common';
import { PlanChange } from './plan-change.dto';

@InputType()
export class ChangeListInput extends SortablePaginationInput<keyof PlanChange>({
  defaultSort: 'createdAt',
}) {
  static defaultVal = new ChangeListInput();
}

@ObjectType()
export class ChangeListOutput extends PaginatedList(PlanChange) {}

@ObjectType({
  description: SecuredList.descriptionFor('changes'),
})
export abstract class SecuredChangeList extends SecuredList(PlanChange) {}
