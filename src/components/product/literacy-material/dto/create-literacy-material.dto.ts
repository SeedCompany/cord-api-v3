import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { MinLength, ValidateNested } from 'class-validator';
import { CreateRange } from '../../range/dto';
import { LiteracyMaterial } from './literacy-material';

@InputType()
export abstract class CreateLiteracyMaterial {
  @Field()
  @MinLength(2)
  readonly name: string;

  @Field(() => [CreateRange], { nullable: true })
  readonly ranges?: CreateRange[];
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
