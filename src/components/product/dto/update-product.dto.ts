import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { stripIndent } from 'common-tags';
import { IdField } from '../../../common';
import { ScriptureRangeInput } from '../../scripture/dto';
import { ProductMedium } from './product-medium';
import { ProductMethodology } from './product-methodology';
import { ProductPurpose } from './product-purpose';
import { AnyProduct, Product } from './product.dto';

@InputType()
export abstract class UpdateProduct {
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

  @Field(() => [ScriptureRangeInput], {
    nullable: true,
    description: stripIndent`
      Change this list of \`scriptureReferences\` if provided.

      Note only \`DirectScriptureProduct\`s can use this field.
    `,
  })
  readonly scriptureReferences?: ScriptureRangeInput[];

  @Field(() => [ScriptureRangeInput], {
    nullable: true,
    description: stripIndent`
      The \`Producible\` defines a \`scriptureReferences\` list, and this is
      used by default in this product's \`scriptureReferences\` list.
      If this product _specifically_ needs to customize the references, then
      this property can be set (and read) to "override" the \`producible\`'s list.

      Note only \`DerivativeScriptureProduct\`s can use this field.
    `,
  })
  readonly scriptureReferencesOverride?: ScriptureRangeInput[];

  @Field(() => [ProductMedium], { nullable: true })
  readonly mediums?: ProductMedium[];

  @Field(() => [ProductPurpose], { nullable: true })
  readonly purposes?: ProductPurpose[];

  @Field(() => ProductMethodology, { nullable: true })
  readonly methodology?: ProductMethodology;
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
