import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { NameField } from '../../../common';
import { ScriptureField, ScriptureRangeInput } from '../../scripture';
import { LiteracyMaterial } from './literacy-material.dto';

@InputType()
export abstract class CreateLiteracyMaterial {
  @NameField()
  readonly name: string;

  @ScriptureField({ nullable: true })
  readonly scriptureReferences?: readonly ScriptureRangeInput[] = [];
}

@InputType()
export abstract class CreateLiteracyMaterialInput {
  @Field()
  @Type(() => CreateLiteracyMaterial)
  @ValidateNested()
  readonly literacyMaterial: CreateLiteracyMaterial;
}

@ObjectType()
export abstract class CreateLiteracyMaterialOutput {
  @Field()
  readonly literacyMaterial: LiteracyMaterial;
}
