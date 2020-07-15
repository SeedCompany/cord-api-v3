import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField, NameField } from '../../../common';
import { ScriptureRangeInput } from '../../scripture';
import { LiteracyMaterial } from './literacy-material.dto';

@InputType()
export abstract class UpdateLiteracyMaterial {
  @IdField()
  readonly id: string;

  @NameField({ nullable: true })
  readonly name?: string;

  @Field(() => [ScriptureRangeInput], { nullable: true })
  readonly scriptureReferences?: ScriptureRangeInput[];
}

@InputType()
export abstract class UpdateLiteracyMaterialInput {
  @Field()
  @Type(() => UpdateLiteracyMaterial)
  @ValidateNested()
  readonly literacyMaterial: UpdateLiteracyMaterial;
}

@ObjectType()
export abstract class UpdateLiteracyMaterialOutput {
  @Field()
  readonly literacyMaterial: LiteracyMaterial;
}
