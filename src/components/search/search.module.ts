import { Module } from '@nestjs/common';
import { FilmModule } from '../film/film.module';
import { LanguageModule } from '../language/language.module';
import { LiteracyMaterialModule } from '../literacy-material/literacy-material.module';
import { LocationModule } from '../location/location.module';
import { OrganizationModule } from '../organization/organization.module';
import { ProjectModule } from '../project/project.module';
import { SongModule } from '../song/song.module';
import { StoryModule } from '../story/story.module';
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
    FilmModule,
    StoryModule,
    LiteracyMaterialModule,
    SongModule,
  ],
  providers: [SearchResolver, SearchService],
  exports: [SearchService],
})
export class SearchModule {}
