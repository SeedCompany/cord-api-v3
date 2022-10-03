import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { SecuredProperty, SecuredProps } from '~/common';
import { RegisterResource } from '~/core';
import { BaseNode } from '~/core/database/results';
import { LanguageEngagement } from '../../engagement/dto';
import { IPeriodicReport, ReportType } from '../../periodic-report/dto';

@RegisterResource()
@ObjectType({
  implements: [IPeriodicReport],
})
export class ProgressReport extends IPeriodicReport {
  static readonly Props = keysOf<ProgressReport>();
  static readonly SecuredProps = keysOf<SecuredProps<ProgressReport>>();
  static readonly Parent = import('../../engagement/dto').then(
    (m) => m.IEngagement
  );

  declare readonly type: ReportType.Progress;

  @Field(() => LanguageEngagement)
  readonly parent: BaseNode;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('Secured progress report'),
})
export class SecuredProgressReport extends SecuredProperty(ProgressReport) {}

declare module '~/core/resources/map' {
  interface ResourceMap {
    ProgressReport: typeof ProgressReport;
  }
}
