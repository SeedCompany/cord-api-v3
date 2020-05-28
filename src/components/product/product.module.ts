import { Module } from '@nestjs/common';
import { FilmModule } from './film/film.module';
import { ProductResolver } from './product.resolver';
import { ProductService } from './product.service';
import { RangeModule } from './range/range.module';

@Module({
  imports: [FilmModule, RangeModule],
  providers: [ProductResolver, ProductService],
  exports: [ProductService],
})
export class ProductModule {}
