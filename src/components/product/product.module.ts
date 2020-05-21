import { Module } from '@nestjs/common';
import { FilmModule } from './film/film.module';
import { ProductResolver } from './product.resolver';
import { ProductService } from './product.service';

@Module({
  imports: [FilmModule],
  providers: [ProductResolver, ProductService],
  exports: [ProductService],
})
export class ProductModule {}
