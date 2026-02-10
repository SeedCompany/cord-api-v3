import { Args, Resolver } from '@nestjs/graphql';
import { from, map, merge, mergeMap } from 'rxjs';
import { omitNotFound$, Subscription } from '~/common';
import { OnHook } from '~/core/hooks';
import { ResourceLoader } from '~/core/resources';
import { ObserveEngagementMutationHook } from '../engagement/hooks';
import {
  DerivativeScriptureProductCreated,
  DerivativeScriptureProductDeleted,
  DerivativeScriptureProductUpdated,
  DirectScriptureProductCreated,
  DirectScriptureProductDeleted,
  DirectScriptureProductUpdated,
  OtherProductCreated,
  OtherProductDeleted,
  OtherProductUpdated,
  ProductCreated,
  ProductDeleted,
  ProductMutationOrDeletion,
  ProductUpdated,
} from './dto/product-mutations.dto';
import {
  ProductChannels,
  ProductCreatedArgs,
  ProductMutationArgs,
  type ProductMutationPayload,
} from './product.channels';

@Resolver()
export class ProductMutationSubscriptionsResolver {
  constructor(
    private readonly channels: ProductChannels,
    private readonly loaders: ResourceLoader,
  ) {}

  @OnHook(ObserveEngagementMutationHook)
  observeEngagementChanges(hook: ObserveEngagementMutationHook) {
    hook.add(this.productMutations(hook.args));
  }

  private verifyReadPermission$() {
    return mergeMap(
      <Payload extends ProductMutationPayload>(payload: Payload) => {
        // Omit event if the user watching doesn't have permission to view the product
        return from(this.loaders.load('Product', payload.product)).pipe(
          omitNotFound$(),
          map(() => payload),
        );
      },
    );
  }

  @Subscription(() => DirectScriptureProductCreated)
  directScriptureProductCreated(@Args() args: ProductCreatedArgs) {
    return this.channels.directCreated(args).pipe(
      this.verifyReadPermission$(),
      map(
        ({
          project,
          engagement,
          product,
          ...rest
        }): DirectScriptureProductCreated => ({
          __typename: 'DirectScriptureProductCreated',
          projectId: project,
          engagementId: engagement,
          productId: product,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => DerivativeScriptureProductCreated)
  derivativeScriptureProductCreated(@Args() args: ProductCreatedArgs) {
    return this.channels.derivativeCreated(args).pipe(
      this.verifyReadPermission$(),
      map(
        ({
          project,
          engagement,
          product,
          ...rest
        }): DerivativeScriptureProductCreated => ({
          __typename: 'DerivativeScriptureProductCreated',
          projectId: project,
          engagementId: engagement,
          productId: product,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => OtherProductCreated)
  otherProductCreated(@Args() args: ProductCreatedArgs) {
    return this.channels.otherCreated(args).pipe(
      this.verifyReadPermission$(),
      map(
        ({ project, engagement, product, ...rest }): OtherProductCreated => ({
          __typename: 'OtherProductCreated',
          projectId: project,
          engagementId: engagement,
          productId: product,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => ProductCreated)
  productCreated(@Args() args: ProductCreatedArgs) {
    return merge(
      this.directScriptureProductCreated(args),
      this.derivativeScriptureProductCreated(args),
      this.otherProductCreated(args),
    );
  }

  @Subscription(() => DirectScriptureProductUpdated)
  directScriptureProductUpdated(@Args() args: ProductMutationArgs) {
    return this.channels.directUpdated(args).pipe(
      this.verifyReadPermission$(),
      map(
        ({
          project,
          engagement,
          product,
          ...rest
        }): DirectScriptureProductUpdated => ({
          __typename: 'DirectScriptureProductUpdated',
          projectId: project,
          engagementId: engagement,
          productId: product,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => DerivativeScriptureProductUpdated)
  derivativeScriptureProductUpdated(@Args() args: ProductMutationArgs) {
    return this.channels.derivativeUpdated(args).pipe(
      this.verifyReadPermission$(),
      map(
        ({
          project,
          engagement,
          product,
          ...rest
        }): DerivativeScriptureProductUpdated => ({
          __typename: 'DerivativeScriptureProductUpdated',
          projectId: project,
          engagementId: engagement,
          productId: product,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => OtherProductUpdated)
  otherProductUpdated(@Args() args: ProductMutationArgs) {
    return this.channels.otherUpdated(args).pipe(
      this.verifyReadPermission$(),
      map(
        ({ project, engagement, product, ...rest }): OtherProductUpdated => ({
          __typename: 'OtherProductUpdated',
          projectId: project,
          engagementId: engagement,
          productId: product,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => ProductUpdated)
  productUpdated(@Args() args: ProductMutationArgs) {
    return merge(
      this.directScriptureProductUpdated(args),
      this.derivativeScriptureProductUpdated(args),
      this.otherProductUpdated(args),
    );
  }

  @Subscription(() => DirectScriptureProductDeleted)
  directScriptureProductDeleted(@Args() args: ProductMutationArgs) {
    return this.channels.directDeleted(args).pipe(
      map(
        ({
          project,
          engagement,
          product,
          ...rest
        }): DirectScriptureProductDeleted => ({
          __typename: 'DirectScriptureProductDeleted',
          projectId: project,
          engagementId: engagement,
          productId: product,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => DerivativeScriptureProductDeleted)
  derivativeScriptureProductDeleted(@Args() args: ProductMutationArgs) {
    return this.channels.derivativeDeleted(args).pipe(
      map(
        ({
          project,
          engagement,
          product,
          ...rest
        }): DerivativeScriptureProductDeleted => ({
          __typename: 'DerivativeScriptureProductDeleted',
          projectId: project,
          engagementId: engagement,
          productId: product,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => OtherProductDeleted)
  otherProductDeleted(@Args() args: ProductMutationArgs) {
    return this.channels.otherDeleted(args).pipe(
      map(
        ({ project, engagement, product, ...rest }): OtherProductDeleted => ({
          __typename: 'OtherProductDeleted',
          projectId: project,
          engagementId: engagement,
          productId: product,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => ProductDeleted)
  productDeleted(@Args() args: ProductMutationArgs) {
    return merge(
      this.directScriptureProductDeleted(args),
      this.derivativeScriptureProductDeleted(args),
      this.otherProductDeleted(args),
    );
  }

  @Subscription(() => ProductMutationOrDeletion, {
    description: 'Subscribe to any mutations of product(s)',
  })
  productMutations(@Args() args: ProductMutationArgs) {
    return merge(
      this.productCreated(args),
      this.productUpdated(args),
      this.productDeleted(args),
    );
  }
}
