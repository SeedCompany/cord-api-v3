import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { NameField } from '../../../../common';
import { UpdateRange } from '../../range/dto';
import { LiteracyMaterial } from './literacy-material';

@InputType()
export abstract class UpdateLiteracyMaterial {
  @Field(() => ID)
  readonly id: string;

  @NameField({ nullable: true })
  readonly name?: string;

  @Field(() => [UpdateRange], { nullable: true })
  readonly ranges?: UpdateRange[];
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
