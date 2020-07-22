import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { stripIndent } from 'common-tags';
import { IdField, OmitType } from '../../../common';
import { CreateProduct } from './create-product.dto';
import { AnyProduct, Product } from './product.dto';

@InputType()
export abstract class UpdateProduct extends OmitType(CreateProduct, [
  'engagementId',
  'produces',
] as const) {
  @IdField()
  readonly id: string;

  @IdField({
    nullable: true,
    description: stripIndent`
      An ID of a \`Producible\` object to change.

      Note only \`DerivativeScriptureProduct\`s can use this field.
    `,
  })
  readonly produces?: string;
}

@InputType()
export abstract class UpdateProductInput {
  @Field()
  @Type(() => UpdateProduct)
  @ValidateNested()
  readonly product: UpdateProduct;
}

@ObjectType()
export abstract class UpdateProductOutput {
  @Field(() => Product)
  readonly product: AnyProduct;
}
