import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import {
  IsAlpha,
  IsLowercase,
  IsNumberString,
  IsPositive,
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
import { ExactLength } from '../../../common/validators/exactLength';
import { Language } from './language.dto';

@InputType()
export abstract class CreateEthnologueLanguage {
  @NameField({ nullable: true })
  @IsAlpha()
  @IsLowercase()
  @ExactLength(3)
  readonly code?: string | null;

  @NameField({ nullable: true })
  @IsAlpha()
  @IsLowercase()
  @ExactLength(3)
  readonly provisionalCode?: string | null;

  @NameField({ nullable: true })
  readonly name?: string | null;

  @Field(() => Int, { nullable: true })
  @IsPositive()
  readonly population?: number | null;
}

@InputType()
export abstract class CreateLanguage {
  @NameField()
  readonly name: string;

  @NameField()
  readonly displayName: string;

  @NameField({ nullable: true })
  readonly displayNamePronunciation?: string | null;

  @Field({ nullable: true })
  readonly isDialect: boolean = false;

  @Field({ nullable: true })
  @Type(() => CreateEthnologueLanguage)
  @ValidateNested()
  readonly ethnologue: CreateEthnologueLanguage = {};

  @Field(() => Int, { nullable: true })
  @IsPositive()
  readonly populationOverride: number | null;

  @NameField({ nullable: true })
  @ExactLength(5)
  @IsNumberString()
  readonly registryOfDialectsCode?: string | null;

  @Field({ nullable: true })
  readonly leastOfThese: boolean = false;

  @NameField({ nullable: true })
  readonly leastOfTheseReason?: string | null;

  @Field({ nullable: true })
  readonly isSignLanguage?: boolean = false;

  @NameField({ nullable: true })
  @Matches(/^[A-Z]{2}\d{2}$/, {
    message: 'Must be 2 uppercase letters followed by 2 digits',
  })
  readonly signLanguageCode?: string | null;

  @SensitivityField({ nullable: true })
  readonly sensitivity?: Sensitivity = Sensitivity.High;

  @DateField({ nullable: true })
  readonly sponsorEstimatedEndDate?: CalendarDate | null;

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
