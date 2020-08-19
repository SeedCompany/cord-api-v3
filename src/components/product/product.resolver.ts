import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
import {
  AnyProduct,
  CreateProductInput,
  CreateProductOutput,
  MethodologyToApproach,
  ProducibleType,
  Product,
  ProductApproach,
  ProductListInput,
  ProductListOutput,
  ProductType,
  UpdateProductInput,
  UpdateProductOutput,
} from './dto';
import { ProductService } from './product.service';

@Resolver(Product)
export class ProductResolver {
  constructor(private readonly productService: ProductService) {}

  @Query(() => Product, {
    description: 'Read a product by id',
  })
  async product(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<AnyProduct> {
    return await this.productService.readOne(id, session);
  }

  @Query(() => ProductListOutput, {
    description: 'Look up products',
  })
  async products(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => ProductListInput,
      defaultValue: ProductListInput.defaultVal,
    })
    input: ProductListInput
  ): Promise<ProductListOutput> {
    return this.productService.list(input, session);
  }

  @ResolveField(() => ProductApproach, { nullable: true })
  approach(@Parent() product: AnyProduct): ProductApproach | null {
    return product.methodology.value
      ? MethodologyToApproach[product.methodology.value]
      : null;
  }

  @ResolveField(() => ProductType, {
    description:
      'Provide what would be the "type" of product in the old schema.',
  })
  legacyType(@Parent() product: AnyProduct): ProductType {
    if (product.produces) {
      const type = product.produces.value?.__typename;
      if (type === ProducibleType.Film) {
        return ProductType.JesusFilm; // TODO not entirely true
      } else if (type === ProducibleType.Song) {
        return ProductType.Songs;
      } else if (type === ProducibleType.Story) {
        return ProductType.BibleStories;
      } else if (type === ProducibleType.LiteracyMaterial) {
        return ProductType.LiteracyMaterials;
      }
    }
    // TODO determine from product.scriptureReferences
    return ProductType.IndividualBooks;
  }

  @Mutation(() => CreateProductOutput, {
    description: 'Create a product entry',
  })
  async createProduct(
    @Session() session: ISession,
    @Args('input') { product: input }: CreateProductInput
  ): Promise<CreateProductOutput> {
    return {
      product: await this.productService.create(input, session),
    };
  }

  @Mutation(() => UpdateProductOutput, {
    description: 'Update a product entry',
  })
  async updateProduct(
    @Session() session: ISession,
    @Args('input') { product: input }: UpdateProductInput
  ): Promise<UpdateProductOutput> {
    const product = await this.productService.update(input, session);
    return { product };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a product entry',
  })
  async deleteProduct(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.productService.delete(id, session);
    return true;
  }
}
