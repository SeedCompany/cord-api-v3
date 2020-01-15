import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { ProductService } from './product.service';
import { CreateProductOutputDto, CreateProductInputDto } from './product.dto';

@Resolver('Product')
export class ProductResolver {
  constructor(private readonly productService: ProductService) {}

  @Mutation(returns => CreateProductOutputDto, {
    description: 'Create a product',
  })
  async createProduct(
    @Args('input') { product: input }: CreateProductInputDto,
  ): Promise<CreateProductOutputDto> {
    return await this.productService.create(input);
  }
}
