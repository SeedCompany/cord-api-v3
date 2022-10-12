import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { parentIdMiddleware, SecuredProperty, SecuredProps } from '~/common';
import { RegisterResource } from '~/core';
import { BaseNode } from '~/core/database/results';
import { LanguageEngagement } from '../../engagement/dto';
import { DefinedFile } from '../../file';
import { IPeriodicReport } from '../../periodic-report/dto/periodic-report.dto';
import { ReportType } from '../../periodic-report/dto/report-type.enum';
import { SecuredProgressReportStatus as SecuredStatus } from './progress-report-status.enum';

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
  override readonly parent: BaseNode;

  /** @deprecated */
  readonly reportFile: DefinedFile;

  @Field(() => SecuredStatus, {
    middleware: [parentIdMiddleware],
  })
  readonly status: SecuredStatus;
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
