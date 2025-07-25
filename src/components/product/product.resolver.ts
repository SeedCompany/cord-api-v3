import {
  Args,
  Info,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Book, labelOfVerseRanges } from '@seedcompany/scripture';
import { stripIndent } from 'common-tags';
import { startCase } from 'lodash';
import { Fields, type ID, IdArg, IsOnlyId, ListArg } from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { type IdsAndView, IdsAndViewArg } from '../changeset/dto';
import { ProductLoader, ProductService } from '../product';
import {
  AvailableStepsOptions,
  CreateDerivativeScriptureProduct,
  CreateDirectScriptureProduct,
  getAvailableSteps,
  ProductStep as Step,
  UpdateDerivativeScriptureProduct,
  UpdateDirectScriptureProduct,
} from '../product/dto';
import { ProjectLoader } from '../project';
import { TranslationProject } from '../project/dto';
import {
  type AnyProduct,
  CreateOtherProduct,
  CreateProductOutput,
  DeleteProductOutput,
  MethodologyToApproach,
  Product,
  ProductApproach,
  ProductCompletionDescriptionSuggestionsInput,
  ProductCompletionDescriptionSuggestionsOutput,
  ProductListInput,
  ProductListOutput,
  UpdateOtherProduct,
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
    @IdsAndViewArg() { id }: IdsAndView,
  ): Promise<AnyProduct> {
    return await products.load(id);
  }

  @Query(() => ProductListOutput, {
    description: 'Look up products',
  })
  async products(
    @ListArg(ProductListInput) input: ProductListInput,
    @Loader(ProductLoader) products: LoaderOf<ProductLoader>,
  ): Promise<ProductListOutput> {
    const list = await this.productService.list(input);
    products.primeAll(list.items);
    return list;
  }

  @ResolveField(() => TranslationProject)
  async project(
    @Parent() product: AnyProduct,
    @Loader(() => ProjectLoader) projects: LoaderOf<ProjectLoader>,
    @Info(Fields, IsOnlyId) onlyId: boolean,
  ) {
    return onlyId
      ? { id: product.project }
      : await projects.load({ id: product.project, view: { active: true } });
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
  label(
    @Parent() product: AnyProduct,
    @Args('collapseAfter', {
      nullable: false,
      description: stripIndent`
        Collapses ranges after a Scripture book after showing the specified
        number of ranges then shows how many more ranges are after that number.
        A value of <= 0  collapses all Scripture ranges of that book.
        Default is 0 (collapse all ranges).

        For example, with a \`collapseAfter\` value of 2:
        \`Genesis 1:2, 1:5, 1:7, 1:9\` becomes \`Genesis 1:2, 1:5 and 2 other portions\`
        with a \`collapseAfter\` value of 0 or less:
        \`Genesis 1:2, 1:5, 1:7, 1:9\` remains the same.

      `,
      type: () => Int,
      defaultValue: 0,
    })
    collapseAfter: number,
  ): string | null {
    if (product.placeholderDescription.value) {
      return product.placeholderDescription.value;
    }
    if (product.title) {
      return product.title.value ?? null;
    }
    if (!product.produces) {
      if (
        !product.scriptureReferences.canRead ||
        !product.unspecifiedScripture.canRead
      ) {
        return null;
      }
      if (product.unspecifiedScripture.value) {
        const { book, totalVerses: verses } =
          product.unspecifiedScripture.value;
        const totalVerses = Book.named(book).totalVerses;
        return `${book} (${verses} / ${totalVerses} verses)`;
      }
      return labelOfVerseRanges(
        product.scriptureReferences.value,
        collapseAfter,
      );
    }
    if (!product.produces.value) {
      return null;
    }
    const produces = product.produces.value;
    // All of our producibles have a name field, so instead of enumerating
    // through them, just fake the type and grab it directly.
    // This also assumes the user can read the name, which is completely unvalidated.
    return (produces as unknown as { name?: string }).name ?? null;
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

  @Query(() => [Step], {
    description: stripIndent`
      Returns a list of available steps for the given constraints.
    `,
  })
  availableProductSteps(
    @Args() options: AvailableStepsOptions,
  ): readonly Step[] {
    return getAvailableSteps(options);
  }

  @ResolveField(() => [Step], {
    description: stripIndent`
      Returns a list of available steps of product.
    `,
  })
  availableSteps(@Parent() product: AnyProduct): readonly Step[] {
    return getAvailableSteps({
      type: product.produces?.value?.__typename,
      methodology: product.methodology.value,
    });
  }

  @Query(() => ProductCompletionDescriptionSuggestionsOutput, {
    description: stripIndent`
      Suggestions for describing a product's completion.
      Use in conjunction with \`Product.describeCompletion\`.
    `,
  })
  async suggestProductCompletionDescriptions(
    @Args('input') input: ProductCompletionDescriptionSuggestionsInput,
  ): Promise<ProductCompletionDescriptionSuggestionsOutput> {
    return await this.productService.suggestCompletionDescriptions(input);
  }

  @Mutation(() => CreateProductOutput, {
    description: 'Create a direct scripture product',
  })
  async createDirectScriptureProduct(
    @Args('input') input: CreateDirectScriptureProduct,
  ): Promise<CreateProductOutput> {
    const product = await this.productService.create(input);
    return { product };
  }

  @Mutation(() => CreateProductOutput, {
    description: 'Create a derivative scripture product',
  })
  async createDerivativeScriptureProduct(
    @Args('input') input: CreateDerivativeScriptureProduct,
  ): Promise<CreateProductOutput> {
    const product = await this.productService.create(input);
    return { product };
  }

  @Mutation(() => CreateProductOutput, {
    description: 'Create an other product entry',
  })
  async createOtherProduct(
    @Args('input') input: CreateOtherProduct,
  ): Promise<CreateProductOutput> {
    const product = await this.productService.create(input);
    return { product };
  }

  @Mutation(() => UpdateProductOutput, {
    description: 'Update a direct scripture product',
  })
  async updateDirectScriptureProduct(
    @Args('input') input: UpdateDirectScriptureProduct,
  ): Promise<UpdateProductOutput> {
    const product = await this.productService.updateDirect(input);
    return { product };
  }

  @Mutation(() => UpdateProductOutput, {
    description: 'Update a derivative scripture product',
  })
  async updateDerivativeScriptureProduct(
    @Args('input') input: UpdateDerivativeScriptureProduct,
  ): Promise<UpdateProductOutput> {
    const product = await this.productService.updateDerivative(input);
    return { product };
  }

  @Mutation(() => UpdateProductOutput, {
    description: 'Update an other product entry',
  })
  async updateOtherProduct(
    @Args('input') input: UpdateOtherProduct,
  ): Promise<UpdateProductOutput> {
    const product = await this.productService.updateOther(input);
    return { product };
  }

  @Mutation(() => DeleteProductOutput, {
    description: 'Delete a product entry',
  })
  async deleteProduct(@IdArg() id: ID): Promise<DeleteProductOutput> {
    await this.productService.delete(id);
    return { success: true };
  }
}
