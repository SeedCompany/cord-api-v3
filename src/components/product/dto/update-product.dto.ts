import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { stripIndent } from 'common-tags';
import {
  CalendarDate,
  DateField,
  ID,
  IdField,
  IntersectionType,
  NameField,
  OmitType,
  PickType,
} from '../../../common';
import {
  CreateBaseProduct,
  CreateDerivativeScriptureProduct,
  CreateDirectScriptureProduct,
  CreateProduct,
} from './create-product.dto';
import { AnyProduct, Product } from './product.dto';

@InputType()
export abstract class UpdateBaseProduct extends OmitType(CreateBaseProduct, [
  'engagementId',
  'createdAt',
  'plannedCompleteDate',
]) {
  @IdField()
  readonly id: ID;

  @DateField({ nullable: true })
  readonly plannedCompleteDate?: CalendarDate;
}

@InputType()
export abstract class UpdateDirectScriptureProduct extends IntersectionType(
  UpdateBaseProduct,
  PickType(CreateDirectScriptureProduct, [
    'scriptureReferences',
    'unspecifiedScripture',
  ])
) {}

@InputType()
export abstract class UpdateDerivativeScriptureProduct extends IntersectionType(
  UpdateBaseProduct,
  PickType(CreateDerivativeScriptureProduct, ['scriptureReferencesOverride'])
) {
  @IdField({
    nullable: true,
    description: stripIndent`
      An ID of a \`Producible\` object to change to.
    `,
  })
  readonly produces?: ID;
}

/**
 * @deprecated
 */
@InputType()
export abstract class UpdateProduct extends OmitType(CreateProduct, [
  'engagementId',
  'produces',
  'plannedCompleteDate',
] as const) {
  @IdField()
  readonly id: ID;

  @IdField({
    nullable: true,
    description: stripIndent`
      An ID of a \`Producible\` object to change.

      Note only \`DerivativeScriptureProduct\`s can use this field.
    `,
  })
  readonly produces?: ID;

  @DateField({ nullable: true })
  readonly plannedCompleteDate?: CalendarDate;
}

/**
 * @deprecated
 */
@InputType()
export abstract class UpdateProductInput {
  @Field()
  @Type(() => UpdateProduct)
  @ValidateNested()
  readonly product: UpdateProduct;
}

@InputType()
export abstract class UpdateOtherProduct extends UpdateBaseProduct {
  @NameField({ nullable: true })
  readonly title?: string;

  @Field(() => String, { nullable: true })
  readonly description?: string | null;
}

@ObjectType()
export abstract class UpdateProductOutput {
  @Field(() => Product)
  readonly product: AnyProduct;
}
