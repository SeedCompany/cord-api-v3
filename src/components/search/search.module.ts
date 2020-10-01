import { Module } from '@nestjs/common';
import { FilmModule } from '../film/film.module';
import { LanguageModule } from '../language/language.module';
import { LiteracyMaterialModule } from '../literacy-material/literacy-material.module';
import { OrganizationModule } from '../organization/organization.module';
import { PartnerModule } from '../partner/partner.module';
import { ProjectModule } from '../project/project.module';
import { SongModule } from '../song/song.module';
import { StoryModule } from '../story/story.module';
import { UserModule } from '../user/user.module';
import { SearchResolver } from './search.resolver';
import { SearchService } from './search.service';

@Module({
  imports: [
    OrganizationModule,
    PartnerModule,
    UserModule,
    LanguageModule,
    ProjectModule,
    FilmModule,
    StoryModule,
    LiteracyMaterialModule,
    SongModule,
  ],
  providers: [SearchResolver, SearchService],
  exports: [SearchService],
})
export class SearchModule {}
