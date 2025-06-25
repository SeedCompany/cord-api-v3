import { Field, ObjectType } from '@nestjs/graphql';
import { type Secured } from '~/common';
import { CalendarDate } from '~/common/temporal';
import { type LinkTo, RegisterResource } from '~/core';
import { e } from '~/core/gel';

@RegisterResource({
  db: e.Organization.AllianceMembership,
})
@ObjectType('AllianceMembership')
export class AllianceMembership {
  readonly alliance: Secured<LinkTo<'Organization'>>;

  readonly member: Secured<LinkTo<'Organization'>>;

  @Field(() => CalendarDate)
  readonly joinedAt: CalendarDate;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    AllianceMembership: typeof AllianceMembership;
  }
  interface ResourceDBMap {
    AllianceMembership: typeof e.Organization.AllianceMembership;
  }
}
