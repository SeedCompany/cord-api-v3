import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { startCase } from 'lodash';
import {
  AnonSession,
  entries,
  ID,
  IdArg,
  LoggedInSession,
  SecuredString,
  Session,
} from '../../common';
import { Loader, LoaderOf } from '../../core';
import { ProductLoader, ProductService } from '../product';
import { labelOfScriptureRanges } from '../scripture/labels';
import {
  AnyProduct,
  AvailableMethodologySteps,
  CreateOtherProduct,
  CreateProductInput,
  CreateProductOutput,
  MethodologyAvailableSteps,
  MethodologyToApproach,
  ProducibleType,
  Product,
  ProductApproach,
  ProductCompletionDescriptionSuggestionsInput,
  ProductCompletionDescriptionSuggestionsOutput,
  ProductListInput,
  ProductListOutput,
  ProductType,
  UpdateOtherProduct,
  UpdateProductInput,
  UpdateProductOutput,
} from './dto';

@Resolver(Product)
export class ProductResolver {
  constructor(private readonly productService: ProductService) {}

  @Query(() => Product, {
    description: 'Read a product by id',
  })
  async product(
    @Loader(ProductLoader) products: LoaderOf<ProductLoader>,
    @IdArg() id: ID
  ): Promise<AnyProduct> {
    return await products.load(id);
  }

  @Query(() => ProductListOutput, {
    description: 'Look up products',
  })
  async products(
    @AnonSession() session: Session,
    @Args({
      name: 'input',
      type: () => ProductListInput,
      defaultValue: ProductListInput.defaultVal,
    })
    input: ProductListInput,
    @Loader(ProductLoader) products: LoaderOf<ProductLoader>
  ): Promise<ProductListOutput> {
    const list = await this.productService.list(input, session);
    products.primeAll(list.items);
    return list;
  }

  @ResolveField(() => ProductApproach, { nullable: true })
  approach(@Parent() product: AnyProduct): ProductApproach | null {
    return product.methodology.value
      ? MethodologyToApproach[product.methodology.value]
      : null;
  }

  @ResolveField(() => String, {
    nullable: true,
    description: stripIndent`
      A label for the product.

      If this is a \`DerivativeScriptureProduct\` then the label could be the
      name or label of the thing being produced.
      If this is a \`DirectScriptureProduct\` then the label could be some of
      the scripture references.
      If you don't have permission to read the necessary properties then this
      could return null.
    `,
  })
  label(@Parent() product: AnyProduct): string | null {
    if (product.title) {
      return product.title.value ?? null;
    }
    if (!product.produces) {
      if (!product.scriptureReferences.canRead) {
        return null;
      }
      return labelOfScriptureRanges(product.scriptureReferences.value);
    }
    if (!product.produces.value) {
      return null;
    }
    const produces = product.produces.value;
    // All of our producibles have a name field, so instead of enumerating
    // through them just fake the type and grab it directly.
    return (produces as unknown as { name: SecuredString }).name.value ?? null;
  }

  @ResolveField(() => String, {
    nullable: true,
    description: stripIndent`
      A "category" label for the product.

      This could be "Scripture" or a label for the type of the object being _produced_.
    `,
  })
  category(@Parent() product: AnyProduct): string | null {
    return product.title
      ? 'Other'
      : !product.produces
      ? 'Scripture'
      : startCase(product.produces.value?.__typename) || null;
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

  @Query(() => [AvailableMethodologySteps], {
    description: stripIndent`
      Returns a list of available steps for each methodology.
      This is returned as a list because GraphQL cannot describe an object with
      dynamic keys. It's probably best to convert this to a map on retrieval.
    `,
  })
  methodologyAvailableSteps(): AvailableMethodologySteps[] {
    return entries(MethodologyAvailableSteps).map(
      ([methodology, steps]): AvailableMethodologySteps => ({
        methodology,
        steps,
      })
    );
  }

  @Query(() => ProductCompletionDescriptionSuggestionsOutput, {
    description: stripIndent`
      Suggestions for describing a product's completion.
      Use in conjunction with \`Product.describeCompletion\`.
    `,
  })
  async suggestProductCompletionDescriptions(
    @Args('input') input: ProductCompletionDescriptionSuggestionsInput
  ): Promise<ProductCompletionDescriptionSuggestionsOutput> {
    return await this.productService.suggestCompletionDescriptions(input);
  }

  @Mutation(() => CreateProductOutput, {
    description: 'Create a product entry',
  })
  async createProduct(
    @LoggedInSession() session: Session,
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
    @LoggedInSession() session: Session,
    @Args('input') { product: input }: UpdateProductInput
  ): Promise<UpdateProductOutput> {
    const product = await this.productService.update(input, session);
    return { product };
  }

  @Mutation(() => CreateProductOutput, {
    description: 'Create an other product entry',
  })
  async createOtherProduct(
    @LoggedInSession() session: Session,
    @Args('input') input: CreateOtherProduct
  ): Promise<CreateProductOutput> {
    const product = await this.productService.create(input, session);
    return { product };
  }

  @Mutation(() => UpdateProductOutput, {
    description: 'Update an other product entry',
  })
  async updateOtherProduct(
    @LoggedInSession() session: Session,
    @Args('input') input: UpdateOtherProduct
  ): Promise<UpdateProductOutput> {
    const product = await this.productService.updateOther(input, session);
    return { product };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a product entry',
  })
  async deleteProduct(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<boolean> {
    await this.productService.delete(id, session);
    return true;
  }
}
