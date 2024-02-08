import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { LanguageModule } from '../language/language.module';
import { OrganizationModule } from '../organization/organization.module';
import { ProjectModule } from '../project/project.module';
import { UserModule } from '../user/user.module';
import { PartnerLoader } from './partner.loader';
import { PartnerRepository } from './partner.repository';
import { PartnerResolver } from './partner.resolver';
import { PartnerService } from './partner.service';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    forwardRef(() => LanguageModule),
    forwardRef(() => ProjectModule),
    forwardRef(() => OrganizationModule),
    forwardRef(() => UserModule),
  ],
  providers: [
    PartnerResolver,
    PartnerService,
    PartnerRepository,
    PartnerLoader,
  ],
  exports: [PartnerService],
})
export class PartnerModule {}
