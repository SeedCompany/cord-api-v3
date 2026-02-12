import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { stripIndent } from 'common-tags';
import {
  type CalendarDate,
  DateField,
  type ID,
  IdField,
  OptionalField,
  type RichTextDocument,
  RichTextField,
} from '~/common';
import { ChangesetIdField } from '../../changeset';
import { CreateDefinedFileVersion } from '../../file/dto';
import { LanguageMilestone } from '../../language/dto';
import { AIAssistedTranslation } from '../../language/dto/ai-assisted-translation.enum';
import { ProductMethodology } from '../../product/dto';
import { InternshipPosition } from './intern-position.enum';
import { EngagementStatus } from './status.enum';

@InputType({ isAbstract: true })
export abstract class UpdateEngagement {
  @IdField()
  readonly id: ID;

  @DateField({ nullable: true })
  readonly completeDate?: CalendarDate | null;

  @DateField({ nullable: true })
  readonly disbursementCompleteDate?: CalendarDate | null;

  @DateField({ nullable: true })
  readonly startDateOverride?: CalendarDate | null;

  @DateField({ nullable: true })
  readonly endDateOverride?: CalendarDate | null;

  readonly initialEndDate?: CalendarDate | null;

  @OptionalField(() => EngagementStatus)
  readonly status?: EngagementStatus;

  @RichTextField({ nullable: true })
  readonly description?: RichTextDocument | null;
}

@InputType()
export abstract class UpdateLanguageEngagement extends UpdateEngagement {
  @Field({ nullable: true })
  readonly firstScripture?: boolean;

  @Field({ nullable: true })
  readonly lukePartnership?: boolean;

  @Field({ nullable: true })
  readonly openToInvestorVisit?: boolean;

  @Field(() => String, { nullable: true })
  readonly paratextRegistryId?: string | null;

  @Field({ nullable: true })
  @Type(() => CreateDefinedFileVersion)
  @ValidateNested()
  readonly pnp?: CreateDefinedFileVersion;

  @Field(() => ProductMethodology, {
    nullable: true,
    description: stripIndent`
      This is the methodology that will be set on products extracted out of the pnp.
      Only a subset is supported here.
      Required to create products when uploading \`pnp\`.
    `,
  })
  readonly methodology?: ProductMethodology;

  @Field(() => String, { nullable: true })
  readonly historicGoal?: string | null;

  @OptionalField(() => LanguageMilestone)
  readonly milestonePlanned?: LanguageMilestone;

  @OptionalField(() => Boolean, { nullable: true })
  readonly milestoneReached?: boolean | null;

  @OptionalField(() => AIAssistedTranslation)
  readonly usingAIAssistedTranslation?: AIAssistedTranslation;

  @ChangesetIdField()
  readonly changeset?: ID;
}

@InputType()
export abstract class UpdateInternshipEngagement extends UpdateEngagement {
  @IdField({ nullable: true })
  readonly mentor?: ID<'User'> | null;

  @IdField({ nullable: true })
  readonly countryOfOrigin?: ID<'Location'> | null;

  @Field(() => InternshipPosition, { nullable: true })
  readonly position?: InternshipPosition | null;

  @Field(() => [ProductMethodology], { nullable: true })
  readonly methodologies?: readonly ProductMethodology[];

  @Field({ nullable: true })
  @Type(() => CreateDefinedFileVersion)
  @ValidateNested()
  readonly growthPlan?: CreateDefinedFileVersion;

  @OptionalField(() => Boolean)
  readonly marketable?: boolean;

  @Field(() => String, { nullable: true })
  readonly webId?: string | null;

  @ChangesetIdField()
  readonly changeset?: ID;
}
