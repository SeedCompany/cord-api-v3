import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  type ID,
  IdField,
  type RichTextDocument,
  RichTextField,
} from '~/common';
import {
  UpdateStepProgress,
  VariantProgressArg,
} from '../../product-progress/dto';
import { type Prompt } from '../../prompts/dto';
import { QuarterPeriodInput } from './quarter-period.input';

@InputType()
export class Rev79TeamNewsInput {
  @RichTextField({ nullable: true })
  readonly response: RichTextDocument | null;
}

@InputType()
export class Rev79CommunityStoryInput {
  @IdField({
    description: 'The ID of the prompt to associate this community story with.',
  })
  readonly promptId: ID<Prompt>;

  @RichTextField({ nullable: true })
  readonly response: RichTextDocument | null;
}

@InputType()
export class Rev79ProductProgressInput extends VariantProgressArg {
  @IdField({ description: 'Which product are you reporting on?' })
  readonly product: ID<'Product'>;

  @Field(() => [UpdateStepProgress])
  @Type(() => UpdateStepProgress)
  @ValidateNested()
  readonly steps: readonly UpdateStepProgress[];
}

@InputType()
export class Rev79ReportItemInput {
  @Field({
    description:
      'The Rev79 community identifier to look up the language engagement within the project.',
  })
  readonly rev79CommunityId: string;

  @Field(() => QuarterPeriodInput, {
    description: 'The year and quarter to resolve the progress report for.',
  })
  readonly period: QuarterPeriodInput;

  @Field(() => Rev79TeamNewsInput, { nullable: true })
  @Type(() => Rev79TeamNewsInput)
  @ValidateNested()
  readonly teamNews?: Rev79TeamNewsInput;

  @Field(() => [Rev79CommunityStoryInput], { nullable: true })
  @Type(() => Rev79CommunityStoryInput)
  @ValidateNested()
  readonly communityStories?: readonly Rev79CommunityStoryInput[];

  @Field(() => [Rev79ProductProgressInput], { nullable: true })
  @Type(() => Rev79ProductProgressInput)
  @ValidateNested()
  readonly productProgress?: readonly Rev79ProductProgressInput[];
}

@InputType()
export class Rev79BulkUploadProgressReportsInput {
  @Field({
    description: 'The Rev79 project identifier to look up the Cord project.',
  })
  readonly rev79ProjectId: string;

  @Field(() => [Rev79ReportItemInput])
  @Type(() => Rev79ReportItemInput)
  @ValidateNested()
  readonly reports: readonly Rev79ReportItemInput[];
}
