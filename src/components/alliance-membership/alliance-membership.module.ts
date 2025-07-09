import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AllianceMembershipLoader } from './alliance-membership.loader';
import { AllianceMembershipRepository } from './alliance-membership.repository';
import { AllianceMembershipResolver } from './alliance-membership.resolver';
import { AllianceMembershipService } from './alliance-membership.service';

@Module({
  imports: [AuthorizationModule],
  providers: [
    AllianceMembershipResolver,
    AllianceMembershipService,
    AllianceMembershipRepository,
    AllianceMembershipLoader,
  ],
  exports: [AllianceMembershipService],
})
export class AllianceMembershipModule {}
