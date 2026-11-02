import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { UserModule } from '../../user/user.module';
import { ProjectModule } from '../project.module';
import { AvailableRolesToProjectResolver } from './available-roles-to-project.resolver';
import { DirectorChangeApplyToProjectMembersHandler } from './handlers/director-change-apply-to-project-members.handler';
import { ProjectRegionDefaultsDirectorMembershipHandler } from './handlers/project-region-defaults-director-membership.handler';
import { RegionsZoneChangesAppliesDirectorChangeToProjectMembersHandler } from './handlers/regions-zone-changes-applies-director-change-to-project-members.handler';
import { MemberProjectConnectionResolver } from './member-project-connection.resolver';
import { MembershipByProjectAndUserLoader } from './membership-by-project-and-user.loader';
import { ProjectMemberMutationSubscriptionsResolver } from './project-member-mutation-subscriptions.resolver';
import { ProjectMemberUpdatedResolver } from './project-member-updated.resolver';
import { ProjectMemberChannels } from './project-member.channels';
import { ProjectMemberLoader } from './project-member.loader';
import { ProjectMemberRepository } from './project-member.repository';
import { ProjectMemberResolver } from './project-member.resolver';
import { ProjectMemberService } from './project-member.service';

@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => AuthorizationModule),
    forwardRef(() => ProjectModule),
  ],
  providers: [
    ProjectMemberResolver,
    ProjectMemberMutationSubscriptionsResolver,
    ProjectMemberUpdatedResolver,
    AvailableRolesToProjectResolver,
    MemberProjectConnectionResolver,
    ProjectMemberService,
    ProjectMemberChannels,
    ProjectMemberRepository,
    ProjectMemberLoader,
    MembershipByProjectAndUserLoader,
    DirectorChangeApplyToProjectMembersHandler,
    RegionsZoneChangesAppliesDirectorChangeToProjectMembersHandler,
    ProjectRegionDefaultsDirectorMembershipHandler,
  ],
  exports: [ProjectMemberService],
})
export class ProjectMemberModule {}
