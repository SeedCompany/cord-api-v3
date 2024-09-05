import { Inject, Injectable } from '@nestjs/common';
import {
  entries,
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
  ClientException,
  DBName,
  EnhancedResource,
  EnumType,
  DBType as GetDBType,
  ID,
  isSortablePaginationInput,
  makeEnum,
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
import type { $linkPropify } from './generated-client/path';
import {
  $expr_Select,
  normaliseShape,
  objectTypeToSelectShape,
  OrderByExpression,
  SelectFilterExpression,
  SelectModifiers,
} from './generated-client/select';
import { UpdateShape } from './generated-client/update';
import { EasyInsertShape, EasyUpdateShape } from './query-util/easy-insert';
import { mapToSetBlock } from './query-util/map-to-set-block';
import { $, e } from './reexports';

/**
 * A repository for a simple DTO. This provides a few methods out of the box.
 */
export const RepoFor = <
  TResourceStatic extends ResourceShape<any>,
  Root extends GetDBType<TResourceStatic>,
  HydratedShape extends objectTypeToSelectShape<Root['__element__']>,
  const OmitKeys extends EnumType<typeof DefaultMethods> = never,
>(
  resourceIn: TResourceStatic,
  {
    hydrate,
  }: {
    hydrate: ShapeFn<Root, HydratedShape>;
    omit?: readonly OmitKeys[];
  },
) => {
  type Dto = $.BaseTypeToTsType<
    $.ObjectType<
      DBName<Root>,
      Root['__element__']['__pointers__'],
      normaliseShape<HydratedShape>,
      Root['__element__']['__exclusives__'],
      Root['__element__']['__polyTypenames__']
    >
  >;

  const resource = EnhancedResource.of(resourceIn);
  const dbType = resource.db as Root;

  @Injectable()
  abstract class Repository extends CommonRepository {
    // TODO clean up
    static customize<
      Customized extends BaseCustomizedRepository,
      OmitKeys extends EnumType<typeof DefaultMethods> = never,
    >(
      customizer: (
        cls: typeof BaseCustomizedRepository,
        ctx: {
          defaults: typeof DefaultMethods;
        },
      ) => AbstractClass<Customized> & {
        omit?: readonly OmitKeys[];
      },
    ): AbstractClass<
      Customized & Omit<DefaultDtoRepository, keyof Customized | OmitKeys>
    > {
      const customizedClass = customizer(BaseCustomizedRepository, {
        defaults: DefaultMethods,
      });
      const customMethodNames = setOf(
        Object.getOwnPropertyNames(customizedClass.prototype),
      );
      const omitKeys = new Set<string>(customizedClass.omit);
      const defaultMethods = Object.getOwnPropertyDescriptors(
        DefaultDtoRepository.prototype,
      );
      const nonDeclaredDefaults = mapKeys(defaultMethods, (name, _, { SKIP }) =>
        typeof name === 'string' &&
        (customMethodNames.has(name) || omitKeys.has(name))
          ? SKIP
          : name,
      ).asRecord;
      Object.defineProperties(customizedClass.prototype, nonDeclaredDefaults);

      // Create defaults instance, once, when needed.
      // Using this customized class instance, but swap out the customized methods for the default ones.
      Object.defineProperty(customizedClass.prototype, 'defaults', {
        get() {
          const defaultsInstance = Object.defineProperties(
            Object.create(this),
            defaultMethods,
          );
          Object.defineProperty(this, 'defaults', { value: defaultsInstance }); // memoize, only once
          return defaultsInstance;
        },
      });

      return customizedClass as any;
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
      _scope: ScopeOf<Root>,
      _input: any,
    ): Many<SelectFilterExpression | false | Nil> {
      return [];
    }
    protected applyFilter(
      scope: ScopeOf<Root>,
      input: any,
    ): { filter: SelectFilterExpression } | {} {
      const filters = many(this.listFilters(scope, input)).filter(isNotFalsy);
      const filter =
        filters.length === 0
          ? null
          : filters.length === 1
          ? filters[0]
          : e.all(e.set(...filters));
      return filter ? { filter } : {};
    }

    protected orderBy(
      scope: ScopeOf<Root>,
      input: SortablePaginationInput,
    ): OrderByExpression {
      if (!(input.sort in scope.__element__.__pointers__)) {
        throw new ClientException(
          `'${input.sort}' is not a valid sort key for '${resource.name}'`,
        );
      }
      return {
        expression: (scope as any)[input.sort],
        direction: input.order,
      };
    }
    protected applyOrderBy(
      scope: ScopeOf<Root>,
      input: PaginationInput,
      // eslint-disable-next-line @typescript-eslint/naming-convention
    ): { order_by?: OrderByExpression } {
      return isSortablePaginationInput(input)
        ? { order_by: this.orderBy(scope, input) }
        : {};
    }

    protected async paginate(
      listOfAllQuery: $expr_Select<
        $.TypeSet<$.ObjectType<DBName<Root>>, $.Cardinality.Many>
      >,
      input: PaginationInput,
    ) {
      const thisPage = e.select(listOfAllQuery as any, () => ({
        offset: (input.page - 1) * input.count,
        limit: input.count + 1,
      }));
      const items = e.select(thisPage, (obj: any) => ({
        ...this.hydrate(obj),
        limit: input.count,
      }));
      const query = e.select({
        items: items as any,
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
      const res = fqn ? this.resources.getByEdgeDB(fqn) : resource;
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

    async deleteNode(
      objectOrId: { id: ID } | ID,
      options: { changeset?: ID; resource?: ResourceLike } = {},
    ) {
      await super.deleteNode(objectOrId, {
        resource: this.resource,
        ...options,
      });
    }
  }

  const readManyQuery = e.params({ ids: e.array(e.uuid) }, ({ ids }) => {
    const entities = e.cast(dbType, e.array_unpack(ids));
    return e.select(entities, hydrate as any);
  });

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
      const rows = await this.db.run(readManyQuery, { ids });
      return rows as readonly Dto[];
    }

    async list(input: PaginationInput) {
      const all = e.select(dbType, (obj: any) => ({
        ...this.applyFilter(obj, input),
        ...this.applyOrderBy(obj, input),
      }));
      return await this.paginate(all as any, input);
    }

    async create(input: EasyInsertShape<Root>): Promise<Dto> {
      const query = e.select(
        (e.insert as any)(dbType, mapToSetBlock(dbType, input, false)),
        this.hydrate as any,
      );
      return (await this.db.run(query)) as Dto;
    }

    async update(input: { id: ID } & EasyUpdateShape<Root>): Promise<Dto> {
      const { id, ...changes } = input;
      const object = e.cast(dbType, e.cast(e.uuid, id));
      const updated = e.update(object, () => ({
        set: mapToSetBlock(dbType, changes, true) as UpdateShape<Root>,
      }));
      const query = e.select(updated, this.hydrate as any);
      return (await this.db.run(query)) as Dto;
    }

    async delete(id: ID): Promise<void> {
      const existing = e.cast(dbType, e.cast(e.uuid, id));
      const query = e.delete(existing);
      await this.db.run(query);
    }
  }

  type DefaultRepoOwnKeys = Exclude<
    keyof DefaultDtoRepository,
    keyof Repository
  > &
    string;
  const DefaultMethods = makeEnum({
    values: entries(
      Object.getOwnPropertyDescriptors(DefaultDtoRepository.prototype),
    ).flatMap(([key]) =>
      typeof key === 'string' && key !== 'constructor'
        ? (key as DefaultRepoOwnKeys)
        : [],
    ),
  });

  class BaseCustomizedRepository extends Repository {
    protected get defaults(): DefaultDtoRepository {
      return this as any;
    }
  }

  return Repository.customize<BaseCustomizedRepository, OmitKeys & {}>(
    (cls) => cls,
  );
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
