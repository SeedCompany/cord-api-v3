import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { ArrayMaxSize, IsIn } from 'class-validator';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  ID,
  IdField,
  RichTextDocument,
  RichTextField,
  SecuredProps,
  SecuredRichTextNullable,
  SecuredStringList,
  SetUnsecuredType,
} from '~/common';
import { RegisterResource } from '~/core/resources';
import { ProgressReport } from '../dto';
import { ProgressReportVarianceExplanationReasonOptions as ReasonOptions } from './reason-options';

@RegisterResource()
@ObjectType()
export abstract class ProgressReportVarianceExplanation {
  static Props = keysOf<ProgressReportVarianceExplanation>();
  static SecuredProps =
    keysOf<SecuredProps<ProgressReportVarianceExplanation>>();
  static readonly Parent = import('../dto').then((m) => m.ProgressReport);
  static readonly ConfirmThisClassPassesSensitivityToPolicies = true;

  readonly report: ProgressReport & SetUnsecuredType<ID>;

  @Field()
  readonly reasons: SecuredStringList;

  @Field()
  readonly comments: SecuredRichTextNullable;
}

@InputType()
export abstract class ProgressReportVarianceExplanationInput {
  @IdField({
    description: 'The progress report ID',
  })
  readonly report: ID;

  @Field(() => [String], { nullable: true })
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
}
