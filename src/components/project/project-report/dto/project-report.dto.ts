import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { CalendarDate, Resource, SecuredProps } from '../../../../common';
import { DefinedFile } from '../../../file';
import { SecuredUser } from '../../../user';
import { PeriodType, ReportType } from './report';

@ObjectType({
  implements: [Resource],
})
export class ProjectReport extends Resource {
  static readonly Props = keysOf<ProjectReport>();
  static readonly SecuredProps = keysOf<SecuredProps<ProjectReport>>();

  @Field()
  readonly user: SecuredUser;

  @Field()
  readonly reportType: ReportType;

  @Field()
  readonly periodType: PeriodType;

  @Field(() => CalendarDate)
  readonly period: CalendarDate;

  readonly reportFile: DefinedFile;
}
