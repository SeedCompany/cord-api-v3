import { Field, Float, InputType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { IsPositive, ValidateNested } from 'class-validator';
import { stripIndent } from 'common-tags';
import { uniq } from 'lodash';
import { type DateTime } from 'luxon';
import { type ID, IdField, NameField } from '~/common';
import {
  ScriptureField,
  type ScriptureRangeInput,
  UnspecifiedScripturePortionInput,
} from '../../scripture/dto';
import { ProductMedium } from './product-medium.enum';
import { ProductMethodology } from './product-methodology.enum';
import { ProductPurpose } from './product-purpose.enum';
import { ProductStep as Step } from './product-step.enum';
import { ProgressMeasurement } from './progress-measurement.enum';

@InputType({
  isAbstract: true,
})
export abstract class CreateBaseProduct {
  @IdField({
    description: 'An ID of a `LanguageEngagement` to create this product for',
  })
  readonly engagement: ID<'LanguageEngagement'>;

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

  @Field(() => String, { nullable: true })
  readonly describeCompletion?: string | null;

  @Field(() => ProgressMeasurement, {
    nullable: true,
    description: 'How will progress for each step be measured?',
  })
  readonly progressStepMeasurement?: ProgressMeasurement;

  @Field(() => Float, {
    nullable: true,
    description: stripIndent`
      The target number that \`StepProgress\` is working towards.
      This input is only considered if \`progressStepMeasurement\` is \`Number\`
    `,
  })
  @IsPositive()
  readonly progressTarget?: number;

  @Field(() => String, {
    nullable: true,
    description: stripIndent`
      Is this product a placeholder for a real product to be determined later?
      If so, this is the description to show in the mean time.
    `,
  })
  @Transform(({ value }) => (value === '' ? null : value))
  readonly placeholderDescription?: string | null;

  readonly pnpIndex?: number | null;

  // Allow specifying this internally only.
  readonly createdAt?: DateTime;
}

@InputType()
export abstract class CreateDirectScriptureProduct extends CreateBaseProduct {
  @ScriptureField({
    nullable: true,
  })
  readonly scriptureReferences?: readonly ScriptureRangeInput[] | null;

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
  readonly scriptureReferencesOverride?: readonly ScriptureRangeInput[] | null;

  @Field({
    description: stripIndent`
      Represents whether the referenced \`Producible\` is a combination of
      multiple individual producibles.
    `,
    nullable: true,
  })
  readonly composite?: boolean;
}

@InputType()
export abstract class CreateOtherProduct extends CreateBaseProduct {
  @NameField()
  readonly title: string;

  @Field(() => String, { nullable: true })
  readonly description?: string | null;
}
