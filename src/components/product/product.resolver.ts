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
import { DateTime } from 'luxon';
import { Fields, type ID, IdArg, IsOnlyId, ListArg } from '~/common';
import { Identity } from '~/core/authentication';
import { Loader, type LoaderOf } from '~/core/data-loader';
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
  DerivativeScriptureProduct,
  DirectScriptureProduct,
  MethodologyToApproach,
  Product,
  ProductApproach,
  ProductCompletionDescriptionSuggestionsInput,
  ProductCompletionDescriptionSuggestionsOutput,
  ProductListInput,
  ProductListOutput,
  resolveProductType,
  UpdateOtherProduct,
} from './dto';
import {
  DerivativeScriptureProductCreated,
  DerivativeScriptureProductUpdated,
  DirectScriptureProductCreated,
  DirectScriptureProductUpdated,
  OtherProductCreated,
  OtherProductUpdated,
  ProductDeleted,
} from './dto/product-mutations.dto';

@Resolver(Product)
export class ProductResolver {
  constructor(
    private readonly productService: ProductService,
    private readonly identity: Identity,
  ) {}

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

  @Mutation(() => DirectScriptureProductCreated, {
    description: 'Create a direct scripture product',
  })
  async createDirectScriptureProduct(
    @Args('input') input: CreateDirectScriptureProduct,
    @Loader(ProductLoader) loader: LoaderOf<ProductLoader>,
  ): Promise<DirectScriptureProductCreated> {
    const product = await this.productService.create(input);
    loader.prime(product.id, product);
    return {
      __typename: 'DirectScriptureProductCreated',
      projectId: product.project,
      engagementId: product.engagement,
      productId: product.id,
      at: product.createdAt,
      by: this.identity.current.userId,
    };
  }

  @Mutation(() => DerivativeScriptureProductCreated, {
    description: 'Create a derivative scripture product',
  })
  async createDerivativeScriptureProduct(
    @Args('input') input: CreateDerivativeScriptureProduct,
    @Loader(ProductLoader) loader: LoaderOf<ProductLoader>,
  ): Promise<DerivativeScriptureProductCreated> {
    const product = await this.productService.create(input);
    loader.prime(product.id, product);
    return {
      __typename: 'DerivativeScriptureProductCreated',
      projectId: product.project,
      engagementId: product.engagement,
      productId: product.id,
      at: product.createdAt,
      by: this.identity.current.userId,
    };
  }

  @Mutation(() => OtherProductCreated, {
    description: 'Create an other product entry',
  })
  async createOtherProduct(
    @Args('input') input: CreateOtherProduct,
    @Loader(ProductLoader) loader: LoaderOf<ProductLoader>,
  ): Promise<OtherProductCreated> {
    const product = await this.productService.create(input);
    loader.prime(product.id, product);
    return {
      __typename: 'OtherProductCreated',
      projectId: product.project,
      engagementId: product.engagement,
      productId: product.id,
      at: product.createdAt,
      by: this.identity.current.userId,
    };
  }

  @Mutation(() => DirectScriptureProductUpdated, {
    description: 'Update a direct scripture product',
  })
  async updateDirectScriptureProduct(
    @Args('input') input: UpdateDirectScriptureProduct,
    @Loader(ProductLoader) loader: LoaderOf<ProductLoader>,
  ): Promise<DirectScriptureProductUpdated> {
    const {
      product,
      payload: { project: _, engagement: __, product: ___, ...payload } = {
        previous: {},
        updated: {},
        at: DateTime.now(),
        by: this.identity.current.userId,
      },
    } = await this.productService.updateDirect(input);
    loader.prime(product.id, product);
    return {
      __typename: 'DirectScriptureProductUpdated',
      projectId: product.project,
      engagementId: product.engagement,
      productId: product.id,
      ...payload,
    };
  }

  @Mutation(() => DerivativeScriptureProductUpdated, {
    description: 'Update a derivative scripture product',
  })
  async updateDerivativeScriptureProduct(
    @Args('input') input: UpdateDerivativeScriptureProduct,
    @Loader(ProductLoader) loader: LoaderOf<ProductLoader>,
  ): Promise<DerivativeScriptureProductUpdated> {
    const {
      product,
      payload: { project: _, engagement: __, product: ___, ...payload } = {
        previous: {},
        updated: {},
        at: DateTime.now(),
        by: this.identity.current.userId,
      },
    } = await this.productService.updateDerivative(input);
    loader.prime(product.id, product);
    return {
      __typename: 'DerivativeScriptureProductUpdated',
      projectId: product.project,
      engagementId: product.engagement,
      productId: product.id,
      ...payload,
    };
  }

  @Mutation(() => OtherProductUpdated, {
    description: 'Update an other product entry',
  })
  async updateOtherProduct(
    @Args('input') input: UpdateOtherProduct,
    @Loader(ProductLoader) loader: LoaderOf<ProductLoader>,
  ): Promise<OtherProductUpdated> {
    const {
      product,
      payload: { project: _, engagement: __, product: ___, ...payload } = {
        previous: {},
        updated: {},
        at: DateTime.now(),
        by: this.identity.current.userId,
      },
    } = await this.productService.updateOther(input);
    loader.prime(product.id, product);
    return {
      __typename: 'OtherProductUpdated',
      projectId: product.project,
      engagementId: product.engagement,
      productId: product.id,
      ...payload,
    };
  }

  @Mutation(() => ProductDeleted, {
    description: 'Delete a product entry',
  })
  async deleteProduct(@IdArg() id: ID): Promise<ProductDeleted> {
    const {
      product,
      payload: { project, engagement, product: _, ...payload },
    } = await this.productService.delete(id);
    const productType = resolveProductType(product);
    return {
      __typename:
        productType === DirectScriptureProduct
          ? 'DirectScriptureProductDeleted'
          : productType === DerivativeScriptureProduct
            ? 'DerivativeScriptureProductDeleted'
            : 'OtherProductDeleted',
      projectId: project,
      engagementId: engagement,
      productId: product.id,
      ...payload,
    };
  }
}
