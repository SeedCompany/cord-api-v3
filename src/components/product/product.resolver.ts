import { Resolver, Args, Query, Mutation } from '@nestjs/graphql';
import { ProductService } from './product.service';
import {
  ReadProductInputDto,
  UpdateProductInput,
  UpdateProductInputDto,
  UpdateProductOutputDto,
  DeleteProductOutputDto,
  DeleteProductInputDto,
} from './product.dto';
import { Session, ISession } from '../auth';
import { IdArg } from '../../common';
import { ReadProductOutput, CreateProductInput, CreateProductOutput } from './dto';

@Resolver('Product')
export class ProductResolver {
  constructor(private readonly productService: ProductService) {}

  @Query(returns => ReadProductOutput, {
    description: 'Read one Product by id',
  })
  async readProduct(
    @Session() session: ISession,
    @Args('input') { product: input }: ReadProductInputDto,
  ): Promise<ReadProductOutput> {
    return {
      product: await this.productService.readOne(input.id, session),
    }
  }

  @Mutation(returns => CreateProductOutput, {
    description: 'Create a product',
  })
  async createProduct(
    @Session() session: ISession,
    @Args('input') { product: input }: CreateProductInput,
  ): Promise<CreateProductOutput> {
    return {
      product: await this.productService.create(input, session)
    };
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
