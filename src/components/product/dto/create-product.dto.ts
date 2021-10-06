import { Field, Float, InputType, ObjectType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { IsPositive, ValidateNested } from 'class-validator';
import { stripIndent } from 'common-tags';
import { uniq } from 'lodash';
import { ID, IdField, NameField } from '../../../common';
import { ScriptureRangeInput } from '../../scripture';
import { MethodologyStep } from './methodology-step.enum';
import { ProductMedium } from './product-medium';
import { ProductMethodology } from './product-methodology';
import { ProductPurpose } from './product-purpose';
import { AnyProduct, Product } from './product.dto';
import { ProgressMeasurement } from './progress-measurement.enum';

@InputType({
  isAbstract: true,
})
export abstract class CreateBaseProduct {
  @IdField({
    description: 'An ID of a `LanguageEngagement` to create this product for',
  })
  readonly engagementId: ID;

  @Field(() => [ProductMedium], { nullable: true })
  @Transform(({ value }) => uniq(value))
  readonly mediums?: readonly ProductMedium[] = [];

  @Field(() => [ProductPurpose], { nullable: true })
  @Transform(({ value }) => uniq(value))
  readonly purposes?: readonly ProductPurpose[] = [];

  @Field(() => ProductMethodology, { nullable: true })
  readonly methodology?: ProductMethodology;

  @Field(() => [MethodologyStep], { nullable: true })
  @Transform(({ value }) => uniq(value))
  readonly steps?: readonly MethodologyStep[] = [];

  @Field({ nullable: true })
  readonly describeCompletion?: string;

  @Field(() => ProgressMeasurement, {
    description: 'How will progress for each step be measured?',
  })
  readonly progressStepMeasurement?: ProgressMeasurement =
    ProgressMeasurement.Percent;

  @Field(() => Float, {
    nullable: true,
    description: stripIndent`
      The target number that \`StepProgress\` is working towards.
      This input is only considered if \`progressStepMeasurement\` is \`Number\`
    `,
  })
  @IsPositive()
  readonly progressTarget?: number;
}

@InputType()
export abstract class CreateDirectScriptureProduct extends CreateBaseProduct {
  @Field(() => [ScriptureRangeInput], {
    nullable: true,
  })
  @ValidateNested()
  @Type(() => ScriptureRangeInput)
  readonly scriptureReferences?: readonly ScriptureRangeInput[];
}

@InputType()
export abstract class CreateDerivativeScriptureProduct extends CreateBaseProduct {
  @IdField({
    description: stripIndent`
      An ID of a \`Producible\` object.
    `,
  })
  readonly produces: ID;

  @Field(() => [ScriptureRangeInput], {
    nullable: true,
    description: stripIndent`
      The \`Producible\` defines a \`scriptureReferences\` list, and this is
      used by default in this product's \`scriptureReferences\` list.
      If this product _specifically_ needs to customize the references, then
      this property can be set (and read) to "override" the \`producible\`'s list.
    `,
  })
  @ValidateNested()
  @Type(() => ScriptureRangeInput)
  readonly scriptureReferencesOverride?: readonly ScriptureRangeInput[];
}

/**
 * @deprecated
 */
@InputType()
export abstract class CreateProduct extends CreateBaseProduct {
  @IdField({
    nullable: true,
    description: stripIndent`
      An ID of a \`Producible\` object, which will create a \`DerivativeScriptureProduct\`.
      If omitted a \`DirectScriptureProduct\` will be created instead.
    `,
  })
  readonly produces?: ID;

  @Field(() => [ScriptureRangeInput], {
    nullable: true,
    description: stripIndent`
      Change this list of \`scriptureReferences\` if provided.

      Note only \`DirectScriptureProduct\`s can use this field.
    `,
  })
  @ValidateNested()
  @Type(() => ScriptureRangeInput)
  readonly scriptureReferences?: readonly ScriptureRangeInput[];

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
  @ValidateNested()
  @Type(() => ScriptureRangeInput)
  readonly scriptureReferencesOverride?: readonly ScriptureRangeInput[];
}

/**
 * @deprecated
 */
@InputType()
export abstract class CreateProductInput {
  @Field()
  @Type(() => CreateProduct)
  @ValidateNested()
  readonly product: CreateProduct;
}

@InputType()
export abstract class CreateOtherProduct extends CreateBaseProduct {
  @NameField()
  readonly title: string;

  @Field(() => String, { nullable: true })
  readonly description?: string | null;
}

@ObjectType()
export abstract class CreateProductOutput {
  @Field(() => Product)
  readonly product: AnyProduct;
}
