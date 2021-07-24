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
import { labelOfScriptureRanges } from '../scripture/labels';
import {
  AnyProduct,
  AvailableMethodologySteps,
  CreateProductInput,
  CreateProductOutput,
  MethodologyAvailableSteps,
  MethodologyToApproach,
  ProducibleType,
  Product,
  ProductApproach,
  ProductListInput,
  ProductListOutput,
  ProductMethodology,
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
    @AnonSession() session: Session,
    @IdArg() id: ID
  ): Promise<AnyProduct> {
    return await this.productService.readOne(id, session);
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
    return !product.produces
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

  @Query(() => [String], {
    description: stripIndent`
      Suggestions for describing a product's completion.
      Use in conjunction with \`Product.describeCompletion\`.
    `,
  })
  async suggestProductCompletionDescriptions(
    @Args('query', {
      nullable: true,
      description: 'A partial description to search for',
    })
    query?: string,
    @Args('methodology', {
      type: () => ProductMethodology,
      nullable: true,
      description:
        'Optionally limit suggestions to only ones for this methodology',
    })
    methodology?: ProductMethodology
  ): Promise<readonly string[]> {
    return await this.productService.suggestCompletionDescriptions(
      query,
      methodology
    );
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
