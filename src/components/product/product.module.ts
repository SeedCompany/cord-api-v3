import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FilmModule } from '../film/film.module';
import { LiteracyMaterialModule } from '../literacy-material/literacy-material.module';
import { ProductStepModule } from '../product-step';
import { ScriptureModule } from '../scripture/scripture.module';
import { SongModule } from '../song/song.module';
import { StoryModule } from '../story/story.module';
import { ProductRepository } from './product.repository';
import { ProductResolver } from './product.resolver';
import { ProductService } from './product.service';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    FilmModule,
    LiteracyMaterialModule,
    StoryModule,
    SongModule,
    ScriptureModule,
    ProductStepModule,
  ],
  providers: [ProductResolver, ProductService, ProductRepository],
  exports: [ProductService, ProductRepository],
})
export class ProductModule {}
