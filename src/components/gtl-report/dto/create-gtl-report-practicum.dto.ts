import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty } from 'class-validator';
import {
  type ID,
  IdField,
  type RichTextDocument,
  RichTextField,
} from '~/common';
import { GtlReportPracticum } from './gtl-report-practicum.dto';

@InputType()
export class CreateGtlReportPracticum {
  @IdField()
  readonly report: ID;

  @Field()
  @IsNotEmpty()
  readonly involvement: string;

  @IdField({ nullable: true })
  readonly mentor?: ID | null;

  @RichTextField({ nullable: true })
  readonly outcomes?: RichTextDocument | null;

  @Field({ nullable: true })
  readonly order?: number;
}

@InputType()
export class UpdateGtlReportPracticum {
  @IdField()
  readonly id: ID;

  @Field({ nullable: true })
  readonly involvement?: string;

  @IdField({ nullable: true })
  readonly mentor?: ID | null;

  @RichTextField({ nullable: true })
  readonly outcomes?: RichTextDocument | null;

  @Field({ nullable: true })
  readonly order?: number;
}

@ObjectType()
export abstract class GtlReportPracticumCreated {
  @Field()
  readonly gtlReportPracticum: GtlReportPracticum;
}

@ObjectType()
export abstract class GtlReportPracticumUpdated {
  @Field()
  readonly gtlReportPracticum: GtlReportPracticum;
}
