import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional } from 'class-validator';
import {
  type ID,
  IdField,
  type RichTextDocument,
  RichTextField,
} from '~/common';
import { GtlReportPracticum } from './gtl-report-practicum.dto';

@InputType()
export class CreateGtlReportPracticum {
  @IdField({ description: 'The GTL report this practicum is reported in' })
  readonly report: ID<'GTLReport'>;

  @Field({ description: 'The practicum or workshop involved in' })
  @IsNotEmpty()
  readonly involvement: string;

  @IdField({ nullable: true, description: 'The mentor involved, if any' })
  readonly mentor?: ID<'User'> | null;

  @RichTextField({ nullable: true })
  readonly outcomes?: RichTextDocument | null;

  @Field(() => Int, { nullable: true })
  readonly order?: number;
}

@InputType()
export class UpdateGtlReportPracticum {
  @IdField()
  readonly id: ID<'GtlReportPracticum'>;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsNotEmpty()
  readonly involvement?: string;

  @IdField({ nullable: true })
  readonly mentor?: ID<'User'> | null;

  @RichTextField({ nullable: true })
  readonly outcomes?: RichTextDocument | null;

  @Field(() => Int, { nullable: true })
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
