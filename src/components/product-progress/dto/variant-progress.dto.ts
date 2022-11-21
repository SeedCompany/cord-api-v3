import { ArgsType, Field, InputType, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  Role,
  SecuredProps,
  SetUnsecuredType,
  Variant,
  VariantInputField,
  VariantOf,
} from '~/common';
import { RegisterResource } from '~/core';
import {
  ProductProgress,
  UnsecuredProductProgress,
} from './product-progress.dto';

export type ProgressVariant = VariantOf<typeof ProgressReportVariantProgress>;

@RegisterResource()
@ObjectType()
export class ProgressReportVariantProgress {
  static readonly Props = keysOf<ProgressReportVariantProgress>();
  static readonly SecuredProps =
    keysOf<SecuredProps<ProgressReportVariantProgress>>();
  static readonly Parent = import(
    '../../progress-report/dto/progress-report.entity'
  ).then((m) => m.ProgressReport);

  static readonly Variants = Variant.createList({
    partner: {
      label: 'Field Partner',
      responsibleRole: Role.FieldPartner,
    },
    official: {
      label: 'Field Operations',
      responsibleRole: Role.ProjectManager,
    },
  });
  static readonly FallbackVariant =
    ProgressReportVariantProgress.Variants.byKey('official');

  @Field(() => Variant)
  readonly variant: Variant<ProgressVariant> &
    SetUnsecuredType<ProgressVariant>;

  readonly details: readonly ProductProgress[] &
    SetUnsecuredType<readonly UnsecuredProductProgress[]>;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    ProgressReportVariantProgress: typeof ProgressReportVariantProgress;
  }
}

@ArgsType()
@InputType({ isAbstract: true })
export class VariantProgressArg {
  @VariantInputField(ProgressReportVariantProgress, {
    defaultValue: ProgressReportVariantProgress.FallbackVariant,
  })
  // @ts-expect-error Ensure property is defined so @Transform runs to apply default value
  readonly variant: Variant<ProgressVariant> = null;
}
