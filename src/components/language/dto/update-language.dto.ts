import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsAlpha,
  IsLowercase,
  IsNumberString,
  IsPositive,
  Matches,
  ValidateNested,
} from 'class-validator';
import {
  type CalendarDate,
  DateField,
  type ID,
  IdField,
  ListField,
  NameField,
  OptionalField,
  Sensitivity,
  SensitivityField,
} from '~/common';
import { ExactLength } from '~/common/validators/exactLength';
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

  @NameField({ optional: true })
  readonly name?: string;

  @NameField({ optional: true })
  readonly displayName?: string;

  @NameField({ nullable: true })
  readonly displayNamePronunciation?: string | null;

  @OptionalField()
  readonly isDialect?: boolean;

  @Field({ nullable: true })
  @Type(() => UpdateEthnologueLanguage)
  @ValidateNested()
  readonly ethnologue?: UpdateEthnologueLanguage;

  @Field(() => Int, { nullable: true })
  @IsPositive()
  readonly populationOverride?: number | null;

  @NameField({
    nullable: true,
    deprecationReason: 'Use registryOfLanguageVarietiesCode instead',
  })
  @ExactLength(5)
  @IsNumberString()
  readonly registryOfDialectsCode?: string | null;

  @NameField({ nullable: true })
  @ExactLength(5)
  @IsNumberString()
  readonly registryOfLanguageVarietiesCode?: string | null;

  @OptionalField()
  readonly leastOfThese?: boolean;

  @NameField({ nullable: true })
  readonly leastOfTheseReason?: string | null;

  @OptionalField()
  readonly isSignLanguage?: boolean;

  @NameField({ nullable: true })
  @Matches(/^[A-Z]{2}\d{2}$/, {
    message: 'Must be 2 uppercase letters followed by 2 digits',
  })
  readonly signLanguageCode?: string | null;

  @SensitivityField({ optional: true })
  readonly sensitivity?: Sensitivity;

  @DateField({ nullable: true })
  readonly sponsorEstimatedEndDate?: CalendarDate | null;

  @OptionalField()
  readonly hasExternalFirstScripture?: boolean;

  @ListField(() => String, { optional: true })
  readonly tags?: readonly string[];

  @OptionalField()
  readonly isAvailableForReporting?: boolean;
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
