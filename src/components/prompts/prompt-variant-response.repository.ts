import { node, type Query, relation } from 'cypher-query-builder';
import { LazyGetter as Once } from 'lazy-get-decorator';
import { DateTime } from 'luxon';
import {
  type ChildListsKey,
  type EnhancedResource,
  type ID,
  Order,
  type PaginatedListType,
  type ResourceShape,
  type UnsecuredDto,
  type VariantList,
  type VariantOf,
} from '~/common';
import { DtoRepository } from '~/core/database';
import { type DbTypeOf } from '~/core/database/db-type';
import { privileges } from '~/core/database/dto.repository';
import {
  ACTIVE,
  createNode,
  createRelationships,
  currentUser,
  defaultPermanentAfter,
  merge,
  paginate,
  prefixNodeLabelsWithDeleted,
  type QueryFragment,
  sorting,
  updateProperty,
  variable,
} from '~/core/database/query';
import {
  conditionalOn,
  determineIfPermanent,
  permanentAfterAsVar,
} from '~/core/database/query/properties/update-property';
import { type EdgePrivileges } from '../authorization';
import { type ChildListAction } from '../authorization/policy/actions';
import {
  type ChangePrompt,
  type ChoosePrompt,
  type PromptVariantResponse,
  type UpdatePromptVariantResponse,
  VariantResponse,
} from './dto';

export const PromptVariantResponseRepository = <
  Parent extends ResourceShape<any>,
  TResourceStatic extends ResourceShape<PromptVariantResponse<TVariant>> & {
    Variants: VariantList<TVariant>;
  },
  TVariant extends string = VariantOf<TResourceStatic>,
>(
  parentEdge: ListEdge<Parent>,
  resource: TResourceStatic,
) => {
  abstract class PromptVariantResponseRepositoryClass extends DtoRepository<TResourceStatic>(
    resource,
  ) {
    declare readonly resource: EnhancedResource<TResourceStatic>;

    @Once()
    get edge() {
      return this[privileges].forEdge(...parentEdge) as EdgePrivileges<
        Parent,
        any,
        ChildListAction
      >;
    }

    async list(
      parentId: ID,
    ): Promise<
      PaginatedListType<UnsecuredDto<PromptVariantResponse<TVariant>>>
    > {
      const result = await this.db
        .query()
        .match([
          node('parent', 'BaseNode', { id: parentId }),
          relation('out', undefined, 'child', ACTIVE),
          node('node', this.resource.dbLabel),
        ])
        .apply(
          sorting(this.resource.type, { sort: 'createdAt', order: Order.ASC }),
        )
        .apply(paginate({ count: 25, page: 1 }, this.hydrate()))
        .first();
      return result!; // the result from paginate() will always have 1 row.
    }

    protected hydrate() {
      return (query: Query) =>
        query
          .apply(this.filterToReadable())
          .match([
            node('parent', 'BaseNode'),
            relation('out', undefined, 'child'),
            node('node'),
          ])
          .match([
            node('node'),
            relation('out', undefined, 'creator'),
            node('creator', 'User'),
          ])
          .match([
            node('node'),
            relation('out', undefined, 'prompt'),
            node('prompt', 'Property'),
          ])
          .subQuery('node', (sub) =>
            sub
              .match([
                node('node'),
                relation('out', undefined, 'child', ACTIVE),
                node('response', 'VariantResponse'),
              ])
              .with(
                merge('response', {
                  modifiedAt:
                    'coalesce(response.modifiedAt, response.createdAt)',
                }).as('response'),
              )
              .return('collect(response) as responses'),
          )
          .return<{ dto: DbTypeOf<InstanceType<TResourceStatic>> }>(
            merge('node', {
              parent: 'parent',
              creator: 'creator { .id }',
              prompt: 'prompt.value',
              responses: 'responses',
            }).as('dto'),
          );
    }

    protected abstract filterToReadable(): QueryFragment;

    async create(
      input: ChoosePrompt,
    ): Promise<UnsecuredDto<PromptVariantResponse<TVariant>>> {
      // @ts-expect-error uhhhh yolo ¯\_(ツ)_/¯
      const resource: typeof PromptVariantResponse = this.resource.type;

      const createdAt = DateTime.now();
      const result = await this.db
        .query()
        .apply(
          await createNode(resource, {
            baseNodeProps: {
              createdAt,
              modifiedAt: createdAt,
            },
            initialProps: {
              prompt: input.prompt,
            },
          }),
        )
        .apply(
          createRelationships(resource, {
            in: {
              child: ['BaseNode', input.resource],
            },
            out: {
              creator: currentUser,
            },
          }),
        )
        .apply(this.hydrate())
        .first();
      return result!.dto;
    }

    async submitResponse(input: UpdatePromptVariantResponse<TVariant>) {
      const query = this.db.query();
      const permanentAfter = permanentAfterAsVar(defaultPermanentAfter, query)!;
      const now = query.params.addParam(DateTime.now(), 'now');
      const responseVar = query.params.addParam(input.response, 'response');
      const newResponse = await createNode(VariantResponse, {
        baseNodeProps: {
          variant: input.variant,
          response: variable(responseVar.toString()),
        },
      });
      await query
        .matchNode('parent', 'PromptVariantResponse', { id: input.id })

        .optionalMatch([
          node('parent'),
          relation('out', undefined, 'child', ACTIVE),
          node('response', 'VariantResponse', { variant: input.variant }),
        ])
        .apply(determineIfPermanent(permanentAfter, now, 'response'))
        .apply(
          conditionalOn(
            'isPermanent',
            ['parent', 'response'],
            (query) =>
              query
                .comment('deactivate old responses for variant')
                .subQuery('response', (sub) =>
                  sub
                    .with('response')
                    .raw('WHERE response IS NOT NULL')
                    .apply(prefixNodeLabelsWithDeleted('response'))
                    .setVariables({
                      'response.active': 'false',
                      'response.deletedAt': now.toString(),
                    })
                    .return('count(response) as oldResponseCount'),
                )

                .comment('create new response for variant')
                .apply(newResponse)
                .apply(
                  createRelationships(resource, {
                    in: {
                      child: variable('parent'),
                    },
                    out: {
                      creator: currentUser,
                    },
                  }),
                )
                .return('count(node) as updatedResponseCount'),
            (query) =>
              query
                .setVariables({
                  'response.response': responseVar.toString(),
                  'response.modifiedAt': now.toString(),
                })
                .return('count(response) as updatedResponseCount'),
          ),
        )
        .with('parent')
        .setVariables({ 'parent.modifiedAt': now.toString() })
        .return('parent')
        .executeAndLogStats();
    }

    async changePrompt(input: ChangePrompt) {
      // @ts-expect-error uhhhh yolo ¯\_(ツ)_/¯
      const resource: typeof PromptVariantResponse = this.resource.type;
      await this.db
        .query()
        .match(node('node', this.resource.dbLabel, { id: input.id }))
        .apply(
          updateProperty({
            resource,
            key: 'prompt',
            value: input.prompt,
          }),
        )
        .setValues({ 'node.modifiedAt': DateTime.now() })
        .return('node')
        .run();
    }
  }

  return PromptVariantResponseRepositoryClass;
};

export type ListEdge<TResourceStatic extends ResourceShape<any>> = [
  resource: TResourceStatic | EnhancedResource<TResourceStatic>,
  key: ChildListsKey<TResourceStatic>,
];
