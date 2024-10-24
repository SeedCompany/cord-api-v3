// PromptVariantResponseEdgeDBRepository

import { Injectable } from '@nestjs/common';
import { RepoFor } from '~/core/edgedb';
import { PromptVariantResponse } from './dto';
import { PublicOf, ResourceShape, VariantList, VariantOf } from '~/common';
import {
  ListEdge,
  PromptVariantResponseRepository,
} from './prompt-variant-response.repository';
import { DbTypeOf } from '~/core';

export const PromptVariantResponseEdgeDBRepository = <
  Parent extends ResourceShape<any>,
  TResourceStatic extends ResourceShape<PromptVariantResponse<TVariant>> & {
    Variants: VariantList<TVariant>;
  },
  TVariant extends string = VariantOf<TResourceStatic>,
>(
  parentEdge: ListEdge<Parent>,
  resource: TResourceStatic,
) => {
  class PromptVariantResponseEdgeDBRepository
    extends RepoFor(<DbTypeOf<InstanceType<TResourceStatic>>>, {
      hydrate: (response) => ({
        ...response['*'],
        parent: true,
        prompt: true,
      }),
    }).withDefaults()
    implements PublicOf<typeof PromptVariantResponseRepository> {
    // something
  }
};

// list of queries from prompt-variant-response.repository.ts
// list - default
// hydrate
// create - default
// submitResponse
// changePrompt
