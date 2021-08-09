import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import {
  IsAlpha,
  IsLowercase,
  IsNumberString,
  IsPositive,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { uniq } from 'lodash';
import {
  CalendarDate,
  DateField,
  NameField,
  Sensitivity,
  SensitivityField,
} from '../../../common';
import { Language } from './language.dto';

@InputType()
export abstract class CreateEthnologueLanguage {
  @NameField({ nullable: true })
  @IsAlpha()
  @IsLowercase()
  @Length(3)
  readonly code?: string;

  @NameField({ nullable: true })
  @IsAlpha()
  @IsLowercase()
  @Length(3)
  readonly provisionalCode?: string;

  @NameField({ nullable: true })
  readonly name?: string;

  @Field(() => Int, { nullable: true })
  @IsPositive()
  readonly population?: number;
}

@InputType()
export abstract class CreateLanguage {
  @NameField()
  readonly name: string;

  @NameField()
  readonly displayName: string;

  @NameField({ nullable: true })
  readonly displayNamePronunciation?: string;

  @Field({ nullable: true })
  readonly isDialect: boolean = false;

  @Field({ nullable: true })
  @Type(() => CreateEthnologueLanguage)
  @ValidateNested()
  readonly ethnologue: CreateEthnologueLanguage = {};

  @Field(() => Int, { nullable: true })
  @IsPositive()
  readonly populationOverride: number;

  @NameField({ nullable: true })
  @Length(5)
  @IsNumberString()
  readonly registryOfDialectsCode?: string;

  @Field({ nullable: true })
  readonly leastOfThese: boolean = false;

  @NameField({ nullable: true })
  readonly leastOfTheseReason?: string;

  @Field({ nullable: true })
  readonly isSignLanguage?: boolean = false;

  @Field({ nullable: true })
  @Matches(/^[A-Z]{2}\d{2}$/)
  readonly signLanguageCode?: string;

  @SensitivityField({ nullable: true })
  readonly sensitivity?: Sensitivity = Sensitivity.High;

  @DateField({ nullable: true })
  readonly sponsorEstimatedEndDate?: CalendarDate;

  @Field({ nullable: true })
  readonly hasExternalFirstScripture?: boolean = false;

  @Field(() => [String], { nullable: true })
  @Transform(({ value }) => uniq(value))
  readonly tags?: string[] = [];
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
