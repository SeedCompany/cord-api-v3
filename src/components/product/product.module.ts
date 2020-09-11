import { Module } from '@nestjs/common';
import { FilmModule } from '../film/film.module';
import { LiteracyMaterialModule } from '../literacy-material/literacy-material.module';
import { ScriptureModule } from '../scripture/scripture.module';
import { SongModule } from '../song/song.module';
import { StoryModule } from '../story/story.module';
import { ProductResolver } from './product.resolver';
import { ProductService } from './product.service';

@Module({
  imports: [
    FilmModule,
    LiteracyMaterialModule,
    StoryModule,
    SongModule,
    ScriptureModule,
  ],
  providers: [ProductResolver, ProductService],
  exports: [ProductService],
})
export class ProductModule {}
