import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { MinLength, ValidateNested } from 'class-validator';
import { UpdateRange } from '../../range/dto';
import { LiteracyMaterial } from './literacy-material';

@InputType()
export abstract class UpdateLiteracyMaterial {
  @Field(() => ID)
  readonly id: string;

  @Field({ nullable: true })
  @MinLength(2)
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
