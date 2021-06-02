import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  ID,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { ProductStep } from './product-step.dto';

@InputType()
export abstract class ProductStepFilters {
  @Field({ nullable: true })
  readonly parentId?: ID;
}

const defaultFilters = {};

@InputType()
export class ProductStepListInput extends SortablePaginationInput<
  keyof ProductStep
>({
  defaultSort: 'createdAt',
}) {
  static defaultVal = new ProductStepListInput();

  @Field({ nullable: true })
  @Type(() => ProductStepFilters)
  @ValidateNested()
  readonly filter: ProductStepFilters = defaultFilters;
}

@ObjectType()
export class ProductStepListOutput extends PaginatedList(ProductStep) {}

@ObjectType({
  description: SecuredList.descriptionFor('productSteps'),
})
export abstract class SecuredProductStepList extends SecuredList(ProductStep) {}
