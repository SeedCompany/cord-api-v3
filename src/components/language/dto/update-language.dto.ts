import { Type } from 'class-transformer';
import {
  MinLength,
  ValidateNested,
  Min,
  Max,
  IsPositive,
} from 'class-validator';
import { DateTime } from 'luxon';
import { Field, ID, InputType, ObjectType, Int } from 'type-graphql';
import { Language } from './language.dto';

@InputType()
export abstract class UpdateLanguage {
  @Field(() => ID)
  readonly id: string;

  @Field({ nullable: true })
  @MinLength(2)
  readonly name?: string;

  @Field({ nullable: true })
  @MinLength(2)
  readonly displayName?: string;

  @Field(() => Int, { nullable: true })
  @Min(1990)
  @Max(DateTime.local().year + 5)
  readonly beginFiscalYear?: number;

  @Field({ nullable: true })
  @MinLength(2)
  readonly ethnologueName?: string;

  @Field(() => Int, { nullable: true })
  @IsPositive()
  readonly ethnologuePopulation?: number;

  @Field(() => Int, { nullable: true })
  @IsPositive()
  readonly organizationPopulation?: number;

  @Field(() => Int, { nullable: true })
  readonly rodNumber?: number;
}

@InputType()
export abstract class UpdateLanguageInput {
  @Field()
  @Type(() => UpdateLanguage)
  @ValidateNested()
  readonly language: UpdateLanguage;
}

@ObjectType()
export abstract class UpdateLanguageOutput {
  @Field()
  readonly language: Language;
}
