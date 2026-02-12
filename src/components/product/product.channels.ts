import { Injectable } from '@nestjs/common';
import { ArgsType } from '@nestjs/graphql';
import { type Many, many } from '@seedcompany/common';
import { Case } from '@seedcompany/common/case';
import { type AllRequired, type ID, IdField } from '~/common';
import { Identity } from '~/core/authentication';
import {
  Broadcaster,
  type BroadcastChannel as Channel,
  CompositeChannel as Composite,
} from '~/core/broadcast';
import {
  EngagementMutationArgs,
  type EngagementMutationPayload,
} from '../engagement/engagement.channels';
import {
  type AnyProduct,
  DerivativeScriptureProduct,
  DirectScriptureProduct,
  resolveProductType,
} from './dto';
import {
  type DerivativeScriptureProductUpdate,
  type DirectScriptureProductUpdate,
  type OtherProductUpdate,
} from './dto/product-mutations.dto';

@ArgsType()
export class ProductCreatedArgs extends EngagementMutationArgs {}

@ArgsType()
export class ProductMutationArgs extends ProductCreatedArgs {
  @IdField({ nullable: true })
  product?: ID<'Product'>;
}

export type ProductMutationPayload = EngagementMutationPayload &
  AllRequired<ProductMutationArgs>;

export type DirectScriptureProductMutationPayload = ProductMutationPayload;

export type DerivativeScriptureProductMutationPayload = ProductMutationPayload;

export type OtherProductMutationPayload = ProductMutationPayload;

type Type = 'direct' | 'derivative' | 'other';
type Action = 'created' | 'updated' | 'deleted';

/**
 * Typed channels for product events.
 */
@Injectable()
export class ProductChannels {
  constructor(
    private readonly identity: Identity,
    private readonly broadcaster: Broadcaster,
  ) {}

  /**
   * Call publish() on the channel action for all arg/filter variations.
   */
  publishToAll<
    TAction extends Action,
    Method extends `${Type}${Case.UpperFirst<TAction>}`,
  >(
    type: Type | AnyProduct,
    action: TAction,
    payload: ReturnType<ProductChannels[Method]> extends Channel<
      infer T extends ProductMutationPayload
    >
      ? Omit<T, 'by'>
      : never,
  ) {
    const channelType: Type =
      typeof type === 'string'
        ? type
        : (() => {
            const cls = resolveProductType(type);
            return cls === DirectScriptureProduct
              ? 'direct'
              : cls === DerivativeScriptureProduct
                ? 'derivative'
                : 'other';
          })();

    const by = this.identity.current.userId;
    const payloadWithBy = { ...payload, by };
    this.forAllActionChannels(channelType, action, payloadWithBy).publish(
      payloadWithBy,
    );
    return payloadWithBy;
  }

  directCreated(
    args: ProductCreatedArgs = {},
  ): Channel<DirectScriptureProductMutationPayload> {
    return this.forAction('direct', 'created', args);
  }

  derivativeCreated(
    args: ProductCreatedArgs = {},
  ): Channel<DerivativeScriptureProductMutationPayload> {
    return this.forAction('derivative', 'created', args);
  }

  otherCreated(
    args: ProductCreatedArgs = {},
  ): Channel<OtherProductMutationPayload> {
    return this.forAction('other', 'created', args);
  }

  directUpdated(args: ProductMutationArgs = {}): Channel<
    DirectScriptureProductMutationPayload & {
      previous: DirectScriptureProductUpdate;
      updated: DirectScriptureProductUpdate;
    }
  > {
    return this.forAction('direct', 'updated', args);
  }

  derivativeUpdated(args: ProductMutationArgs = {}): Channel<
    DerivativeScriptureProductMutationPayload & {
      previous: DerivativeScriptureProductUpdate;
      updated: DerivativeScriptureProductUpdate;
    }
  > {
    return this.forAction('derivative', 'updated', args);
  }

  otherUpdated(args: ProductMutationArgs = {}): Channel<
    OtherProductMutationPayload & {
      previous: OtherProductUpdate;
      updated: OtherProductUpdate;
    }
  > {
    return this.forAction('other', 'updated', args);
  }

  directDeleted(
    args: ProductMutationArgs = {},
  ): Channel<ProductMutationPayload> {
    return this.forAction('direct', 'deleted', args);
  }

  derivativeDeleted(
    args: ProductMutationArgs = {},
  ): Channel<ProductMutationPayload> {
    return this.forAction('derivative', 'deleted', args);
  }

  otherDeleted(
    args: ProductMutationArgs = {},
  ): Channel<ProductMutationPayload> {
    return this.forAction('other', 'deleted', args);
  }

  private forAllActionChannels<T>(
    type: Type,
    action: Action,
    payload: ProductMutationPayload,
  ): Channel<T> {
    return Composite.for([
      this.forAction(type, action, { product: payload.product }),
      this.forAction(type, action, { engagement: payload.engagement }),
      this.forAction(type, action, { project: payload.project }),
      this.forAction(type, action, { program: payload.program }),
      this.forAction(type, action, {}),
    ]);
  }

  private forAction<T>(
    type: Type,
    action: Action,
    args: ProductMutationArgs,
  ): Channel<T> {
    if (args.product) {
      if (action === 'created') {
        return this.channel([]);
      }
      return this.channel(`${type}-product:${args.product}:${action}`);
    }
    if (args.engagement) {
      return this.channel(
        `engagement:${args.engagement}:${type}-product:${action}`,
      );
    }
    if (args.project) {
      return this.channel(`project:${args.project}:${type}-product:${action}`);
    }
    if (args.program?.length) {
      const programs = many(args.program);
      return this.channel(
        programs.map(
          (program) =>
            `program:${Case.kebab(program)}:${type}-product:${action}`,
        ),
      );
    }
    return this.channel(`${type}-product:${action}`);
  }

  private channel<T>(channels: Many<string>): Channel<T> {
    return Composite.for(
      many(channels).map((name) => this.broadcaster.channel(name)),
    );
  }
}
