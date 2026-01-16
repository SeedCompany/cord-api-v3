import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { ArrayMaxSize, IsIn } from 'class-validator';
import {
  type ID,
  IdField,
  ListField,
  type RichTextDocument,
  RichTextField,
  SecuredRichTextNullable,
  SecuredStringList,
  type SetUnsecuredType,
} from '~/common';
import { e } from '~/core/gel';
import { type LinkTo, RegisterResource } from '~/core/resources';
import { type ProgressReport } from '../dto';
import { ProgressReportVarianceExplanationReasonOptions as ReasonOptions } from './reason-options';

@RegisterResource({ db: e.ProgressReport.VarianceExplanation })
@ObjectType()
export abstract class ProgressReportVarianceExplanation {
  static readonly Parent = () => import('../dto').then((m) => m.ProgressReport);
  static readonly ConfirmThisClassPassesSensitivityToPolicies = true;

  readonly report: ProgressReport & SetUnsecuredType<LinkTo<'ProgressReport'>>;

  @Field()
  readonly reasons: SecuredStringList;

  @Field()
  readonly comments: SecuredRichTextNullable;
}

@InputType()
export abstract class ExplainProgressVariance {
  @IdField({
    description: 'The progress report ID',
  })
  readonly report: ID;

  @ListField(() => String, {
    optional: true,
    transform: (prev) => (value) => (value === null ? [] : prev(value)),
  })
  @IsIn([...ReasonOptions.instance.all], {
    each: true,
    message: 'Reason is not one of our available choices',
  })
  @ArrayMaxSize(1) // Straddling a single reason for now but being super trivial to allow multiple in the future.
  readonly reasons?: readonly string[];

  @RichTextField({ nullable: true })
  readonly comments?: RichTextDocument | null;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    ProgressReportVarianceExplanation: typeof ProgressReportVarianceExplanation;
  }
  interface ResourceDBMap {
    ProgressReportVarianceExplanation: typeof e.ProgressReport.VarianceExplanation;
  }
}
