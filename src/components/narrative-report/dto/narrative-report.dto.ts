import { ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { SecuredProps } from '../../../common';
import { IPeriodicReport } from '../../periodic-report/dto/periodic-report.dto';
import { ReportType } from '../../periodic-report/dto/report-type.enum';

@ObjectType({
  implements: [IPeriodicReport],
})
export class NarrativeReport extends IPeriodicReport {
  static readonly Props = keysOf<NarrativeReport>();
  static readonly SecuredProps = keysOf<SecuredProps<NarrativeReport>>();

  readonly type: ReportType.Narrative;
}
