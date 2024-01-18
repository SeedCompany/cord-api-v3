import { Inject, Injectable } from '@nestjs/common';
import {
  isNotFalsy,
  many,
  Many,
  mapKeys,
  Nil,
  setOf,
} from '@seedcompany/common';
import { LazyGetter as Once } from 'lazy-get-decorator';
import { lowerCase } from 'lodash';
import { AbstractClass } from 'type-fest';
import {
  EnhancedResource,
  ID,
  NotFoundException,
  PaginatedListType,
  PaginationInput,
  ResourceShape,
  SortablePaginationInput,
} from '~/common';
import { ResourceLike } from '~/core';
import { Privileges } from '../../components/authorization';
import { getChanges } from '../database/changes';
import { privileges } from '../database/dto.repository';
import { CommonRepository } from './common.repository';
import { InsertShape } from './generated-client/insert';
import { $expr_PathNode, $linkPropify } from './generated-client/path';
import {
  $expr_Select,
  objectTypeToSelectShape,
  SelectFilterExpression,
  SelectModifiers,
} from './generated-client/select';
import { UpdateShape } from './generated-client/update';
import { $, e } from './reexports';

/**
 * A repository for a simple DTO. This provides a few methods out of the box.
 */
export const RepoFor = <
  TResourceStatic extends ResourceShape<any>,
  DBType extends (TResourceStatic['DB'] & {})['__element__'],
  HydratedShape extends objectTypeToSelectShape<DBType> = (TResourceStatic['DB'] & {})['*'],
>(
  resourceIn: TResourceStatic,
  options: {
    hydrate?: ShapeFn<$.TypeSet<DBType>, HydratedShape>;
  } = {},
) => {
  type Dto = $.computeObjectShape<DBType['__pointers__'], HydratedShape>;

  const resource = EnhancedResource.of(resourceIn);

  const hydrate = e.shape(
    resource.db,
    (options.hydrate ?? ((obj: any) => obj['*'])) as any,
  ) as (scope: unknown) => HydratedShape;

  @Injectable()
  abstract class Repository extends CommonRepository {
    static customize<Customized extends Repository>(
      customizer: (cls: typeof Repository) => AbstractClass<Customized>,
    ): AbstractClass<
      Customized & Omit<DefaultDtoRepository, keyof Customized>
    > {
      const customizedClass = customizer(Repository);
      const customMethodNames = setOf(
        Object.getOwnPropertyNames(customizedClass.prototype),
      );
      const nonDeclaredDefaults = mapKeys(
        Object.getOwnPropertyDescriptors(DefaultDtoRepository.prototype),
        (name, _, { SKIP }) =>
          typeof name === 'string' && customMethodNames.has(name) ? SKIP : name,
      ).asRecord;
      Object.defineProperties(customizedClass.prototype, nonDeclaredDefaults);

      return customizedClass as any;
    }
    static withDefaults() {
      return DefaultDtoRepository;
    }

    @Inject(Privileges)
    protected readonly [privileges]: Privileges;
    protected readonly resource = resource;
    protected readonly hydrate = hydrate;

    @Once()
    get privileges() {
      return this[privileges].forResource(resource);
    }

    getActualChanges = getChanges(resource.type);

    // region List Helpers

    protected listFilters(
      _scope: ScopeOf<$.TypeSet<DBType>>,
      _input: any,
    ): Many<SelectFilterExpression | false | Nil> {
      return [];
    }

    protected orderBy<Scope extends $expr_PathNode>(
      scope: ScopeOf<$.TypeSet<DBType>>,
      input: SortablePaginationInput,
    ) {
      // TODO Validate this is a valid sort key
      const sortKey = input.sort as keyof Scope['*'];
      return {
        expression: scope[sortKey],
        direction: input.order,
      } as const;
    }

    protected async paginate(
      listOfAllQuery: $expr_Select<
        $.TypeSet<$.ObjectType<DBType['__name__']>, $.Cardinality.Many>
      >,
      input: PaginationInput,
    ) {
      const thisPage = e.select(listOfAllQuery as any, () => ({
        offset: (input.page - 1) * input.count,
        limit: input.count + 1,
      }));
      const items = e.select(thisPage, (obj) => ({
        ...this.hydrate(obj),
        limit: input.count,
      }));
      const query = e.select({
        items,
        total: e.count(listOfAllQuery),
        hasMore: e.op(e.count(thisPage), '>', input.count),
      });

      const result = await this.db.run(query);
      return result as PaginatedListType<Dto>;
    }

    // endregion

    /**
     * Here for compatibility with the Neo4j version.
     * @deprecated this should be replaced with just error handling from a
     * failed insert, after we finish migration.
     */
    async isUnique(value: string, fqn?: string) {
      const res = fqn ? await this.resources.getByEdgeDB(fqn) : resource;
      const query = e.select(e.Mixin.Named, (obj) => ({
        filter: e.op(
          e.op(obj.name, '=', value),
          'and',
          e.op(obj.__type__.name, '=', res.dbFQN as string),
        ),
        limit: 1,
      }));

      const found = await this.db.run(query);
      return found.length === 0;
    }

    async getBaseNodes(ids: readonly ID[], fqn?: ResourceLike) {
      return await super.getBaseNodes(ids, fqn ?? resource);
    }
  }

  class DefaultDtoRepository extends Repository {
    async readOne(id: ID) {
      const rows = await this.readMany([id]);
      if (!rows[0]) {
        throw new NotFoundException(
          `Could not find ${lowerCase(this.resource.name)}`,
        );
      }
      return rows[0];
    }

    async readMany(ids: readonly ID[]): Promise<readonly Dto[]> {
      const query = e.params({ ids: e.array(e.uuid) }, ({ ids }) =>
        e.select(this.resource.db, (obj: any) => ({
          ...(this.hydrate(obj) as any),
          filter: e.op(obj.id, 'in', e.array_unpack(ids)),
        })),
      );
      const rows = await this.db.run(query, { ids });
      return rows as readonly Dto[];
    }

    async list(input: PaginationInput) {
      const all = e.select(this.resource.db, (obj: any) => {
        const filters = many(this.listFilters(obj, input)).filter(isNotFalsy);
        const filter =
          filters.length === 0
            ? null
            : filters.length === 1
            ? filters[0]
            : e.all(e.set(...filters));
        return {
          ...(filter ? { filter } : {}),
          ...(input instanceof SortablePaginationInput
            ? { order_by: this.orderBy(obj, input as SortablePaginationInput) }
            : {}),
        };
      });
      return await this.paginate(all as any, input);
    }

    async create(input: Omit<InsertShape<DBType>, `@${string}`>): Promise<Dto> {
      const query = e.select(
        e.insert(this.resource.db, input as any),
        this.hydrate as any,
      );
      return (await this.db.run(query)) as Dto;
    }

    async update(
      existing: Pick<Dto, 'id'>,
      input: UpdateShape<TResourceStatic['DB'] & {}>,
    ): Promise<Dto> {
      const object = e.cast(
        this.resource.db,
        e.cast(e.uuid, existing.id as ID),
      );
      const updated = e.update(object, () => ({
        set: input,
      }));
      const query = e.select(updated, this.hydrate as any);
      return (await this.db.run(query)) as Dto;
    }

    async delete(id: ID): Promise<void> {
      const existing = e.cast(this.resource.db, e.cast(e.uuid, id));
      const query = e.delete(existing);
      await this.db.run(query);
    }
  }

  return Repository;
};

type ShapeFn<
  Expr extends $.ObjectTypeExpression,
  Shape extends objectTypeToSelectShape<Expr['__element__']> &
    SelectModifiers<Expr['__element__']>,
> = (scope: ScopeOf<Expr>) => Readonly<Shape>;

export type ScopeOf<Expr extends $.ObjectTypeExpression> = $.$scopify<
  Expr['__element__']
> &
  $linkPropify<{
    [k in keyof Expr]: k extends '__cardinality__'
      ? $.Cardinality.One
      : Expr[k];
  }>;
