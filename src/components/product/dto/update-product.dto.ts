import { Field, InputType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import {
  type ID,
  IdField,
  IntersectTypes,
  NameField,
  OmitType,
  PickType,
} from '~/common';
import {
  CreateBaseProduct,
  CreateDerivativeScriptureProduct,
  CreateDirectScriptureProduct,
} from './create-product.dto';

@InputType()
export abstract class UpdateBaseProduct extends OmitType(CreateBaseProduct, [
  'engagement',
  'createdAt',
  'pnpIndex',
]) {
  @IdField()
  readonly id: ID;
}

@InputType()
export abstract class UpdateDirectScriptureProduct extends IntersectTypes(
  UpdateBaseProduct,
  PickType(CreateDirectScriptureProduct, [
    'scriptureReferences',
    'unspecifiedScripture',
  ]),
) {
  totalVerses?: number;
  totalVerseEquivalents?: number;
}

@InputType()
export abstract class UpdateDerivativeScriptureProduct extends IntersectTypes(
  UpdateBaseProduct,
  PickType(CreateDerivativeScriptureProduct, [
    'scriptureReferencesOverride',
    'composite',
  ]),
) {
  @IdField({
    optional: true,
    description: stripIndent`
      An ID of a \`Producible\` object to change to.
    `,
  })
  readonly produces?: ID;

  totalVerses?: number;
  totalVerseEquivalents?: number;
}

@InputType()
export abstract class UpdateOtherProduct extends UpdateBaseProduct {
  @NameField({ optional: true })
  readonly title?: string;

  @Field(() => String, { nullable: true })
  readonly description?: string | null;
}
