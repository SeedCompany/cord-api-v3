import { Module } from '@nestjs/common';
import { LanguageModule } from '../language/language.module';
import { LocationModule } from '../location/location.module';
import { OrganizationModule } from '../organization/organization.module';
import { ProjectModule } from '../project/project.module';
import { UserModule } from '../user/user.module';
import { SearchResolver } from './search.resolver';
import { SearchService } from './search.service';

@Module({
  imports: [
    OrganizationModule,
    UserModule,
    LocationModule,
    LanguageModule,
    ProjectModule,
  ],
  providers: [SearchResolver, SearchService],
  exports: [SearchService],
})
export class SearchModule {}
