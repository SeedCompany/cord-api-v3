import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField, NameField } from '../../../common';
import { ScriptureField, ScriptureRangeInput } from '../../scripture';
import { LiteracyMaterial } from './literacy-material.dto';

@InputType()
export abstract class UpdateLiteracyMaterial {
  @IdField()
  readonly id: ID;

  @NameField({ nullable: true })
  readonly name?: string;

  @ScriptureField({ nullable: true })
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
