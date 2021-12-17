import { Field, Float, InputType, ObjectType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { IsPositive, ValidateNested } from 'class-validator';
import { stripIndent } from 'common-tags';
import { uniq } from 'lodash';
import { DateTime } from 'luxon';
import { ID, IdField, NameField } from '../../../common';
import {
  ScriptureField,
  ScriptureRangeInput,
  UnspecifiedScripturePortionInput,
} from '../../scripture';
import { ProductMedium } from './product-medium';
import { ProductMethodology } from './product-methodology';
import { ProductPurpose } from './product-purpose';
import { ProductStep as Step } from './product-step.enum';
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
  readonly mediums?: readonly ProductMedium[];

  @Field(() => [ProductPurpose], { nullable: true })
  @Transform(({ value }) => uniq(value))
  readonly purposes?: readonly ProductPurpose[];

  @Field(() => ProductMethodology, { nullable: true })
  readonly methodology?: ProductMethodology;

  @Field(() => [Step], { nullable: true })
  @Transform(({ value }) => uniq(value))
  readonly steps?: readonly Step[];

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

  // Allow specifying this internally only.
  readonly createdAt?: DateTime;
}

@InputType()
export abstract class CreateDirectScriptureProduct extends CreateBaseProduct {
  @ScriptureField({
    nullable: true,
  })
  readonly scriptureReferences?: readonly ScriptureRangeInput[];

  @Field(() => UnspecifiedScripturePortionInput, {
    nullable: true,
  })
  @ValidateNested()
  @Type(() => UnspecifiedScripturePortionInput)
  readonly unspecifiedScripture?: UnspecifiedScripturePortionInput | null;
}

@InputType()
export abstract class CreateDerivativeScriptureProduct extends CreateBaseProduct {
  @IdField({
    description: stripIndent`
      An ID of a \`Producible\` object.
    `,
  })
  readonly produces: ID;

  @ScriptureField({
    nullable: true,
    description: stripIndent`
      The \`Producible\` defines a \`scriptureReferences\` list, and this is
      used by default in this product's \`scriptureReferences\` list.
      If this product _specifically_ needs to customize the references, then
      this property can be set (and read) to "override" the \`producible\`'s list.
    `,
  })
  readonly scriptureReferencesOverride?: readonly ScriptureRangeInput[];

  @Field({
    description: stripIndent`
      Represents whether the referenced \`Producible\` is a combination of
      multiple individual producibles.
    `,
    nullable: true,
  })
  readonly composite?: boolean;
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

  @ScriptureField({
    nullable: true,
    description: stripIndent`
      Change this list of \`scriptureReferences\` if provided.

      Note only \`DirectScriptureProduct\`s can use this field.
    `,
  })
  readonly scriptureReferences?: readonly ScriptureRangeInput[];

  @ScriptureField({
    nullable: true,
    description: stripIndent`
      The \`Producible\` defines a \`scriptureReferences\` list, and this is
      used by default in this product's \`scriptureReferences\` list.
      If this product _specifically_ needs to customize the references, then
      this property can be set (and read) to "override" the \`producible\`'s list.

      Note only \`DerivativeScriptureProduct\`s can use this field.
    `,
  })
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
