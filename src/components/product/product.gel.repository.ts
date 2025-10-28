import { Injectable, type Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { LazyGetter } from 'lazy-get-decorator';
import { type ID, type PublicOf } from '../../common';
import { grabInstances } from '../../common/instance-maps';
import { e, RepoFor } from '../../core/gel';
import {
  ProductConcretes as ConcreteTypes,
  type CreateDerivativeScriptureProduct,
  type CreateDirectScriptureProduct,
  type CreateOtherProduct,
  Product,
} from './dto';
import { type ProductRepository } from './product.repository';

// scriptureReferencesOverride, scriptureReferences

const baseHydrate = e.shape(e.Product, (product) => ({
  ...product['*'],
  __typename: product.__type__.name,
  project: {
    id: true,
    status: true,
    type: true,
  },
  engagement: {
    id: true,
    status: true,
  },
  parent: e.select({
    identity: product.engagement.id,
    labels: e.array_agg(e.set(product.engagement.__type__.name.slice(9, null))),
    properties: e.select({
      id: product.engagement.id,
      createdAt: product.engagement.createdAt,
    }),
  }),
  pnpIndex: true,
  scriptureReferences: product.scripture,
}));

const directScriptureExtraHydrate = {
  totalVerses: true,
  totalVerseEquivalents: true,
} as const;

const derivativeScriptureExtraHydrate = {
  scripture: true,
  composite: true,
  totalVerses: true,
  totalVerseEquivalents: true,
} as const;

const otherExtraHydrate = {
  title: true,
  description: true,
} as const;

const directScriptureProductHydrate = e.shape(
  e.DirectScriptureProduct,
  (dsp) => ({
    ...baseHydrate(dsp),
    __typename: dsp.__type__.name,
    unspecifiedScripture: {
      book: true,
      totalVerses: true,
    },
    //TODO - remove after migration
    unspecifiedScripturePortion: {
      book: true,
      totalVerses: true,
    },
    ...directScriptureExtraHydrate,
  }),
);

const derivativeScriptureProductHydrate = e.shape(
  e.DerivativeScriptureProduct,
  (dsp) => ({
    ...baseHydrate(dsp),
    __typename: dsp.__type__.name,
    scriptureReferencesOverride: dsp.scriptureOverride,
    produces: {
      scriptureReferences: e.select([dsp.produces.scripture]),
      createdAt: dsp.produces.createdAt,
      id: dsp.produces.id,
    },
    ...derivativeScriptureExtraHydrate,
  }),
);

const otherProductHydrate = e.shape(e.OtherProduct, (op) => ({
  ...baseHydrate(op),
  __typename: op.__type__.name,
  scriptureReferencesOverride: false, //TODO - remove after migration
  ...otherExtraHydrate,
}));

const hydrate = e.shape(e.Product, (product) => ({
  ...baseHydrate(product),
  ...e.is(e.DirectScriptureProduct, directScriptureExtraHydrate),
  ...e.is(e.DerivativeScriptureProduct, derivativeScriptureExtraHydrate),
  ...e.is(e.OtherProduct, otherExtraHydrate),
}));

export const ConcreteRepos = {
  DirectScriptureProduct: class DirectScriptureProductRepository extends RepoFor(
    ConcreteTypes.DirectScriptureProduct,
    {
      hydrate: directScriptureProductHydrate,
      omit: ['create'],
    },
  ) {
    async create(input: CreateDirectScriptureProduct) {
      const engagement = e.cast(
        e.LanguageEngagement,
        e.uuid(input.engagementId),
      );
      return await this.defaults.create({
        ...input,
        projectContext: engagement.projectContext,
      });
    }
  },

  DerivativeScriptureProduct: class DerivativeScriptureProductRepository extends RepoFor(
    ConcreteTypes.DerivativeScriptureProduct,
    {
      hydrate: derivativeScriptureProductHydrate,
      omit: ['create'],
    },
  ) {
    async create(input: CreateDerivativeScriptureProduct) {
      const engagement = e.cast(
        e.LanguageEngagement,
        e.uuid(input.engagementId),
      );
      return await this.defaults.create({
        ...input,
        projectContext: engagement.projectContext,
      });
    }
  },

  OtherProduct: class OtherProductRepository extends RepoFor(
    ConcreteTypes.OtherProduct,
    {
      hydrate: otherProductHydrate,
      omit: ['create'],
    },
  ) {
    async create(input: CreateOtherProduct) {
      const engagement = e.cast(
        e.LanguageEngagement,
        e.uuid(input.engagementId),
      );
      return await this.defaults.create({
        ...input,
        projectContext: engagement.projectContext,
      });
    }
  },
} satisfies Record<keyof typeof ConcreteTypes, Type>;

@Injectable()
export class ProductGelRepository
  extends RepoFor(Product, {
    hydrate,
    omit: ['create'],
  })
  implements PublicOf<ProductRepository>
{
  constructor(private readonly moduleRef: ModuleRef) {
    super();
  }

  @LazyGetter() protected get concretes() {
    return grabInstances(this.moduleRef, ConcreteRepos);
  }

  async createDerivative(
    input: CreateDerivativeScriptureProduct & {
      totalVerses: number;
      totalVerseEquivalents: number;
    },
  ) {
    return await this.concretes.DerivativeScriptureProduct.create(input);
  }

  async createDirect(
    input: CreateDirectScriptureProduct & {
      totalVerses: number;
      totalVerseEquivalents: number;
    },
  ) {
    return await this.concretes.DirectScriptureProduct.create(input);
  }

  async createOther(input: CreateOtherProduct) {
    return await this.concretes.OtherProduct.create(input);
  }

  async listIdsAndScriptureRefs(engagementId: ID) {
    const engagement = e.cast(e.LanguageEngagement, e.uuid(engagementId));
    const query = e.select(e.DirectScriptureProduct, (dsp) => ({
      id: true,
      pnpIndex: true,
      scriptureRanges: dsp.scripture,
      unspecifiedScripture: dsp.unspecifiedScripture,
      filter: e.op(dsp.engagement, '=', engagement),
    }));

    return await this.db.run(query);
  }

  async listIdsWithPnpIndexes(engagementId: ID, _type?: string) {
    const engagement = e.cast(e.LanguageEngagement, e.uuid(engagementId));

    const query = e.select(e.Product, (p) => ({
      id: true,
      pnpIndex: p.pnpIndex,
      ...e.is(e.DirectScriptureProduct, {}),
      filter: e.op(p.engagement, '=', engagement),
    }));

    return await this.db.run(query);
  }
}
