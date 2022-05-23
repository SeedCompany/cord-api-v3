import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { stripIndent } from 'common-tags';
import {
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
  'pnpIndex',
]) {
  @IdField()
  readonly id: ID;
}

@InputType()
export abstract class UpdateDirectScriptureProduct extends IntersectionType(
  UpdateBaseProduct,
  PickType(CreateDirectScriptureProduct, [
    'scriptureReferences',
    'unspecifiedScripture',
  ])
) {
  totalVerses?: number;
  totalVerseEquivalents?: number;
}

@InputType()
export abstract class UpdateDirectScriptureProductInput {
  @IdField({
    description: 'The change object to associate these product changes with',
    nullable: true,
  })
  readonly changeset?: ID;

  @Field()
  @Type(() => UpdateDirectScriptureProduct)
  @ValidateNested()
  readonly product: UpdateDirectScriptureProduct;
}

@InputType()
export abstract class UpdateDerivativeScriptureProduct extends IntersectionType(
  UpdateBaseProduct,
  PickType(CreateDerivativeScriptureProduct, [
    'scriptureReferencesOverride',
    'composite',
  ])
) {
  @IdField({
    nullable: true,
    description: stripIndent`
      An ID of a \`Producible\` object to change to.
    `,
  })
  readonly produces?: ID;

  totalVerses?: number;
  totalVerseEquivalents?: number;
}

@InputType()
export abstract class UpdateDerivativeScriptureProductInput {
  @IdField({
    description: 'The change object to associate these product changes with',
    nullable: true,
  })
  readonly changeset?: ID;

  @Field()
  @Type(() => UpdateDerivativeScriptureProduct)
  @ValidateNested()
  readonly product: UpdateDerivativeScriptureProduct;
}

/**
 * @deprecated
 */
@InputType()
export abstract class UpdateProduct extends OmitType(CreateProduct, [
  'engagementId',
  'produces',
  'pnpIndex',
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

@InputType()
export abstract class UpdateOtherProductInput {
  @IdField({
    description: 'The change object to associate these product changes with',
    nullable: true,
  })
  readonly changeset?: ID;

  @Field()
  @Type(() => UpdateOtherProduct)
  @ValidateNested()
  readonly product: UpdateOtherProduct;
}

@ObjectType()
export abstract class UpdateProductOutput {
  @Field(() => Product)
  readonly product: AnyProduct;
}
