import { node, Query, relation } from 'cypher-query-builder';
import { LazyGetter as Once } from 'lazy-get-decorator';
import { DateTime } from 'luxon';
import {
  ChildListsKey,
  EnhancedResource,
  ID,
  Order,
  PaginatedListType,
  ResourceShape,
  Session,
  UnsecuredDto,
} from '~/common';
import { DtoRepository } from '~/core';
import { privileges } from '~/core/database/dto.repository';
import {
  ACTIVE,
  apoc,
  createNode,
  createRelationships,
  merge,
  paginate,
  prefixNodeLabelsWithDeleted,
  QueryFragment,
  sorting,
  variable,
} from '~/core/database/query';
import { EdgePrivileges } from '../authorization';
import { ChildListAction } from '../authorization/policy/actions';
import {
  ChangePrompt,
  ChoosePrompt,
  PromptVariantResponse,
  UpdatePromptVariantResponse,
  VariantResponse,
} from './dto';
import { VariantList, VariantOf } from './dto/variant.dto';

export const PromptVariantResponseRepository = <
  Parent extends ResourceShape<any>,
  TResourceStatic extends ResourceShape<PromptVariantResponse<TVariant>> & {
    Variants: VariantList<TVariant>;
  },
  TVariant extends string = VariantOf<TResourceStatic>
>(
  parentEdge: ListEdge<Parent>,
  resource: TResourceStatic
) => {
  abstract class PromptVariantResponseRepositoryClass extends DtoRepository<
    TResourceStatic,
    [Session]
  >(resource) {
    readonly resource: EnhancedResource<TResourceStatic>;

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
      session: Session
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
          sorting(this.resource.type, { sort: 'createdAt', order: Order.ASC })
        )
        .apply(paginate({ count: 25, page: 1 }, this.hydrate(session)))
        .first();
      return result!; // the result from paginate() will always have 1 row.
    }

    protected hydrate(session: Session) {
      return (query: Query) =>
        query
          .apply(this.filterToReadable(session))
          .match([
            node('parent', 'BaseNode'),
            relation('out', undefined, 'child'),
            node('node'),
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
              .with(apoc.convert.toMap('response').as('response'))
              .return('collect(response) as responses')
          )
          .return<{ dto: UnsecuredDto<InstanceType<TResourceStatic>> }>(
            merge('node', {
              parent: 'parent',
              prompt: 'prompt.value',
              responses: 'responses',
            }).as('dto')
          );
    }

    protected abstract filterToReadable(session: Session): QueryFragment;

    async create(
      input: ChoosePrompt,
      session: Session
    ): Promise<UnsecuredDto<PromptVariantResponse<TVariant>>> {
      // @ts-expect-error uhhhh yolo ¯\_(ツ)_/¯
      const resource: typeof PromptVariantResponse = this.resource.type;
      const result = await this.db
        .query()
        .apply(
          await createNode(resource, {
            baseNodeProps: {
              creator: session.userId,
            },
            initialProps: {
              prompt: input.prompt,
            },
          })
        )
        .apply(
          createRelationships(resource, 'in', {
            child: ['BaseNode', input.resource],
          })
        )
        .apply(this.hydrate(session))
        .first();
      return result!.dto;
    }

    async submitResponse(
      input: UpdatePromptVariantResponse<TVariant>,
      session: Session
    ) {
      await this.db
        .query()
        .matchNode('parent', 'PromptVariantResponse', { id: input.id })

        .comment('deactivate old responses for variant')
        .subQuery('parent', (sub) =>
          sub
            .match([
              node('parent'),
              relation('out', undefined, 'child', ACTIVE),
              node('response', 'VariantResponse', { variant: input.variant }),
            ])
            // TODO just delete created less than 1 hour?
            .apply(prefixNodeLabelsWithDeleted('response'))
            .setValues({
              'response.active': false,
              'response.deletedAt': DateTime.local(),
            })
            .return('count(response) as oldResponseCount')
        )

        .comment('create new response for variant')
        .apply(
          await createNode(VariantResponse, {
            baseNodeProps: {
              variant: input.variant,
              response: input.response,
              creator: session.userId,
            },
          })
        )
        .apply(
          createRelationships(resource, 'in', {
            child: variable('parent'),
          })
        )
        .return('parent')
        .first();
    }

    async changePrompt(input: ChangePrompt, _session: Session) {
      await this.db.updateProperty({
        type: this.resource.type,
        object: { id: input.id } as any,
        key: 'prompt',
        value: input.prompt,
      });
    }
  }

  return PromptVariantResponseRepositoryClass;
};

export type ListEdge<TResourceStatic extends ResourceShape<any>> = [
  resource: TResourceStatic | EnhancedResource<TResourceStatic>,
  key: ChildListsKey<TResourceStatic>
];
