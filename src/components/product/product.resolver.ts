import { Resolver, Args, Query, Mutation } from '@nestjs/graphql';
import { ProductService } from './product.service';
import {
  CreateProductInput,
  CreateProductInputDto,
  CreateProductOutputDto,
  ReadProductInputDto,
  UpdateProductInput,
  UpdateProductInputDto,
  UpdateProductOutputDto,
  DeleteProductOutputDto,
  DeleteProductInputDto,
} from './product.dto';
import { Session, ISession } from '../auth';
import { IdArg } from '../../common';
import { ReadProductOutput } from './dto';

@Resolver('Product')
export class ProductResolver {
  constructor(private readonly productService: ProductService) {}

  @Query(returns => ReadProductOutput, {
    description: 'Read one Product by id',
  })
  async readProduct(
    @Args('input') { product: input }: ReadProductInputDto,
  ): Promise<ReadProductOutput> {
    return {
      product: await this.productService.readOne(input.id),
    }
  }

  @Mutation(returns => CreateProductOutputDto, {
    description: 'Create a product',
  })
  async createProduct(
    @Args('input') { product: input }: CreateProductInputDto,
  ): Promise<CreateProductOutputDto> {
    return await this.productService.create(input);
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
    @Session() session: ISession,
    @IdArg() id: string,
  ): Promise<void> {

    return await this.productService.delete(id, session);
  }
}
