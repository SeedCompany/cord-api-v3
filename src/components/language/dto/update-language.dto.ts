import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsPositive, Max, Min, ValidateNested } from 'class-validator';
import { DateTime } from 'luxon';
import { NameField } from '../../../common';
import { Language } from './language.dto';

@InputType()
export abstract class UpdateLanguage {
  @Field(() => ID)
  readonly id: string;

  @NameField({ nullable: true })
  readonly name?: string;

  @NameField({ nullable: true })
  readonly displayName?: string;

  @Field(() => Int, { nullable: true })
  @Min(1990)
  @Max(DateTime.local().year + 5)
  readonly beginFiscalYear?: number;

  @NameField({ nullable: true })
  readonly ethnologueName?: string;

  @Field(() => Int, { nullable: true })
  @IsPositive()
  readonly ethnologuePopulation?: number;

  @Field(() => Int, { nullable: true })
  @IsPositive()
  readonly organizationPopulation?: number;

  @Field({ nullable: true })
  readonly rodNumber?: string;
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
