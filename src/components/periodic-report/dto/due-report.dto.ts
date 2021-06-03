import { Field, ObjectType } from '@nestjs/graphql';
import { SecuredProperty } from '../../../common';
import { IPeriodicReport, PeriodicReport } from './periodic-report.dto';

@ObjectType()
export class DueReport {
  @Field(() => IPeriodicReport, { nullable: true })
  readonly current: PeriodicReport | null;

  @Field(() => IPeriodicReport, { nullable: true })
  readonly next: PeriodicReport | null;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('due report'),
})
export class SecuredDueReport extends SecuredProperty(DueReport) {}
