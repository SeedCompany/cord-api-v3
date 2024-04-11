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
  ID,
  IdField,
  NameField,
  Sensitivity,
  SensitivityField,
} from '../../../common';
import { ExactLength } from '../../../common/validators/exactLength';
import { ChangesetIdField } from '../../changeset';
import { Language } from './language.dto';

@InputType()
export abstract class UpdateEthnologueLanguage {
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
export abstract class UpdateLanguage {
  @IdField()
  readonly id: ID;

  @NameField({ nullable: true })
  readonly name?: string;

  @NameField({ nullable: true })
  readonly displayName?: string;

  @NameField({ nullable: true })
  readonly displayNamePronunciation?: string | null;

  @Field({ nullable: true })
  readonly isDialect?: boolean;

  @Field({ nullable: true })
  @Type(() => UpdateEthnologueLanguage)
  @ValidateNested()
  readonly ethnologue?: UpdateEthnologueLanguage;

  @Field(() => Int, { nullable: true })
  @IsPositive()
  readonly populationOverride?: number | null;

  @NameField({ nullable: true })
  @ExactLength(5)
  @IsNumberString()
  readonly registryOfDialectsCode?: string | null;

  @Field({ nullable: true })
  readonly leastOfThese?: boolean;

  @NameField({ nullable: true })
  readonly leastOfTheseReason?: string | null;

  @Field({ nullable: true })
  readonly isSignLanguage?: boolean;

  @NameField({ nullable: true })
  @Matches(/^[A-Z]{2}\d{2}$/, {
    message: 'Must be 2 uppercase letters followed by 2 digits',
  })
  readonly signLanguageCode?: string | null;

  @SensitivityField({ nullable: true })
  readonly sensitivity?: Sensitivity;

  @DateField({ nullable: true })
  readonly sponsorEstimatedEndDate?: CalendarDate | null;

  @Field({ nullable: true })
  readonly hasExternalFirstScripture?: boolean;

  @Field(() => [String], { nullable: true })
  @Transform(({ value }) => uniq(value))
  readonly tags?: string[];
}

@InputType()
export abstract class UpdateLanguageInput {
  @ChangesetIdField()
  readonly changeset?: ID;

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
