import { Resolver, Args, Query, Mutation } from '@nestjs/graphql';
import { ProductService } from './product.service';
import { Session, ISession } from '../auth';
import { IdArg } from '../../common';
import { CreateProductInput, CreateProductOutput, UpdateProductInput, UpdateProductOutput, Product } from './dto';

@Resolver('Product')
export class ProductResolver {
  constructor(private readonly productService: ProductService) {}

  @Query(returns => Product, {
    description: 'Read a product by id',
  })
  async product(
    @Session() session: ISession,
    @IdArg() id: string,
  ): Promise<Product> {
    return await this.productService.readOne(id, session);
  }

  @Mutation(returns => CreateProductOutput, {
    description: 'Create a product entry',
  })
  async createProduct(
    @Session() session: ISession,
    @Args('input') { product: input }: CreateProductInput,
  ): Promise<CreateProductOutput> {
    return {
      product: await this.productService.create(input, session)
    };
  }

  @Mutation(() => UpdateProductOutput, {
    description: 'Update a product entry',
  })
  async updateProduct(
    @Session() session: ISession,
    @Args('input') { product: input }: UpdateProductInput,
  ): Promise<UpdateProductOutput> {
    const product = await this.productService.update(input, session);
    return { product };
  }

  @Mutation(returns => Boolean, {
    description: 'Delete a product entry',
  })
  async deleteProduct(
    @Session() session: ISession,
    @IdArg() id: string,
  ): Promise<boolean> {
    await this.productService.delete(id, session);
    return true;
  }
}
