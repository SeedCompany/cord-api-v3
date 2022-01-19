import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  CalendarDate,
  SecuredDate,
  SecuredPropertyList,
  SecuredProps,
} from '../../../common';
import { ProductStep } from './product-step.enum';

@InputType()
export abstract class ProductStepInfoInput {
  @Field()
  name: ProductStep;

  @Field()
  plannedCompleteDate: CalendarDate;
}

@ObjectType()
export abstract class ProductStepInfo {
  static readonly Props: string[] = keysOf<ProductStepInfo>();
  static readonly SecuredProps: string[] =
    keysOf<SecuredProps<ProductStepInfo>>();

  @Field(() => ProductStep)
  readonly name: ProductStep;

  @Field()
  readonly plannedCompleteDate: SecuredDate;
}

@ObjectType({
  description: SecuredPropertyList.descriptionFor('product step list'),
})
export class SecuredProductStepList extends SecuredPropertyList(
  ProductStepInfo
) {}
