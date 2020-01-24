import { Resolver, Args, Query, Mutation } from '@nestjs/graphql';
import { ProductService } from './product.service';
import {
  CreateProductInput,
  CreateProductInputDto,
  CreateProductOutputDto,
  ReadProductInputDto,
  ReadProductOutputDto,
  UpdateProductInput,
  UpdateProductInputDto,
  UpdateProductOutputDto,
  DeleteProductOutputDto,
  DeleteProductInputDto,
} from './product.dto';

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
  @Query(returns => ReadProductOutputDto, {
    description: 'Read one Product by id',
  })
  async readProduct(
    @Args('input') { product: input }: ReadProductInputDto,
  ): Promise<ReadProductOutputDto> {
    return await this.productService.readOne(input);
  }

  @Mutation(returns => UpdateProductOutputDto, {
    description: 'Update an Product',
  })
  async updateProduct(
    @Args('input')
    { product: input }: UpdateProductInputDto,
  ): Promise<UpdateProductOutputDto> {
    return await this.productService.update(input);
  }

  @Mutation(returns => DeleteProductOutputDto, {
    description: 'Delete an Product',
  })
  async deleteProduct(
    @Args('input')
    { product: input }: DeleteProductInputDto,
  ): Promise<DeleteProductOutputDto> {
    return await this.productService.delete(input);
  }
}
