import { Injectable } from '@nestjs/common';
import { CalendarDate, type PublicOf, type UnsecuredDto } from '~/common';
import { e, RepoFor } from '~/core/gel';
import { type AllianceMembershipRepository } from './alliance-membership.repository';
import { AllianceMembership, type CreateAllianceMembership } from './dto';

@Injectable()
export class AllianceMembershipGelRepository
  extends RepoFor(AllianceMembership, {
    hydrate: (allianceMembership) => ({
      __typename: e.str('AllianceMembership'),
      ...allianceMembership['*'],
      member: true,
      alliance: true,
    }),
    omit: ['create'],
  })
  implements PublicOf<AllianceMembershipRepository>
{
  async create(
    input: CreateAllianceMembership,
  ): Promise<UnsecuredDto<AllianceMembership>> {
    const joinedAt = input.joinedAt ?? CalendarDate.local();

    const query = e.params(
      {
        memberId: e.uuid,
        allianceId: e.uuid,
        joinedAt: e.cal.local_date,
      },
      ($) => {
        const member = e.cast(e.Organization, $.memberId);
        const alliance = e.cast(e.Organization, $.allianceId);

        const created = e.insert(this.resource.db, {
          member,
          alliance,
          joinedAt: $.joinedAt,
        });

        return e.select(created, this.hydrate);
      },
    );

    return await this.db.run(query, {
      memberId: input.memberId,
      allianceId: input.allianceId,
      joinedAt,
    });
  }
}
