import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsPositive, Max, Min, ValidateNested } from 'class-validator';
import { DateTime } from 'luxon';
import { NameField } from '../../../common';
import { Language } from './language.dto';

@InputType()
export abstract class CreateLanguage {
  @NameField()
  readonly name: string;

  @NameField()
  readonly displayName: string;

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
export abstract class CreateLanguageInput {
  @Field()
  @Type(() => CreateLanguage)
  @ValidateNested()
  readonly language: CreateLanguage;
}

@ObjectType()
export abstract class CreateLanguageOutput {
  @Field()
  readonly language: Language;
}
