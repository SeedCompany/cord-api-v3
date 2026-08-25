import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty } from 'class-validator';
import {
  type ID,
  IdField,
  type RichTextDocument,
  RichTextField,
} from '~/common';
import { GtlReportGoal } from './gtl-report-goal.dto';

@InputType()
export class CreateGtlReportGoal {
  @IdField({ description: 'The report this goal is being set in' })
  readonly report: ID;

  @Field()
  @IsNotEmpty()
  readonly goal: string;

  @RichTextField({ nullable: true })
  readonly details?: RichTextDocument | null;

  @Field({ nullable: true })
  readonly order?: number;
}

@ObjectType()
export abstract class GtlReportGoalCreated {
  @Field()
  readonly gtlReportGoal: GtlReportGoal;
}
