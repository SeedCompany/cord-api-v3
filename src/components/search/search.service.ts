import { Injectable } from '@nestjs/common';
import { isNotNil, setHas, setOf } from '@seedcompany/common';
import { uniqBy } from 'lodash';
import { ValueOf } from 'type-fest';
import { ID, NotFoundException, ServerException, Session } from '~/common';
import { ResourceMap, ResourceResolver, ResourcesHost } from '~/core/resources';
import { Privileges } from '../authorization';
import { LanguageService } from '../language';
import { PartnerService } from '../partner';
import {
  SearchableMap,
  SearchInput,
  SearchOutput,
  SearchResult,
  SearchResultTypes,
} from './dto';
import { SearchRepository } from './search.repository';

type HydratorMap = {
  [K in keyof SearchableMap]?: Hydrator<SearchableMap[K]>;
};
type Hydrator<R> = (id: ID, session: Session) => Promise<R>;

type Match<Types extends string> = ValueOf<{
  [Type in Types]: {
    type: Type;
    id: ID;
    matchedProps: readonly string[];
  };
}>;

@Injectable()
export class SearchService {
  // mapping of base nodes to functions that,
  // given id & session, will return the object.
  /* eslint-disable @typescript-eslint/naming-convention */
  private readonly customHydrators: HydratorMap = {
    PartnerByOrg: async (...args) => ({
      ...(await this.partners.readOnePartnerByOrgId(...args)),
      __typename: 'Partner',
    }),
    LanguageByEth: async (...args) => ({
      ...(await this.languages.readOneByEthId(...args)),
      __typename: 'Language',
    }),
  };
  /* eslint-enable @typescript-eslint/naming-convention */

  constructor(
    private readonly resources: ResourcesHost,
    private readonly resourceResolver: ResourceResolver,
    private readonly privileges: Privileges,
    private readonly partners: PartnerService,
    private readonly languages: LanguageService,
    private readonly repo: SearchRepository,
  ) {}

  async search(input: SearchInput, session: Session): Promise<SearchOutput> {
    const types = input.type
      ? setOf(
          // Expand interfaces to their concretes
          // This is needed here now, because below we confirm the match results
          // are within this `types` filter
          // and those results are the concretes not the interfaces.
          input.type
            .flatMap((type) =>
              this.resources.getImplementations(this.resources.enhance(type)),
            )
            .flatMap((type) =>
              setHas(SearchResultTypes, type.name) ? type.name : [],
            ),
        )
      : // if a type filter isn't specified default to all types
        SearchResultTypes;

    const resourceTypes = new Set<keyof ResourceMap>(types);
    // Include dependency types for types that have identifiers in sub-resources.
    types.has('Partner') && resourceTypes.add('Organization');
    types.has('Language') && resourceTypes.add('EthnologueLanguage');

    // Search for nodes based on input, only returning their id and "type"
    // which is based on their first valid search label.
    const results = await this.repo.search({
      ...input,
      type: [...resourceTypes],
    });

    const maybeHydrated = await Promise.all(
      results
        // Normalize result & resolve type from neo4j data
        .map(({ node, matchedProps }) => {
          const result = {
            type: this.resourceResolver.resolveTypeByBaseNode(node),
            id: node.properties.id,
            matchedProps,
          };
          return result as Match<keyof ResourceMap>;
        })
        // Ensure resource types matched are within the search type filters
        // and handle special cases.
        .flatMap<Match<keyof SearchableMap>>((result) => {
          if (result.type === 'Organization') {
            return [
              ...(types.has('Organization') ? [result] : []),
              ...(types.has('Partner')
                ? [
                    {
                      type: 'PartnerByOrg',
                      id: result.id,
                      matchedProps: ['organization'],
                    } as const,
                  ]
                : []),
            ];
          }
          if (result.type === 'EthnologueLanguage') {
            return {
              type: 'LanguageByEth',
              id: result.id,
              matchedProps: ['ethnologue'],
            } as const;
          }

          // This is a sanity/type check.
          // Functionally, we shouldn't have any results at this point that
          // aren't within the `types` filter.
          // However, this does require that the logic above is in sync with
          // the resources & type filters.
          return setHas(types, result.type)
            ? (result as Extract<typeof result, { type: keyof SearchableMap }>)
            : [];
        })
        // Do hydration data loading for each identified resource.
        .map(
          async ({ type, id, matchedProps }): Promise<SearchResult | null> => {
            const hydrator = this.hydrate(type);
            const hydrated = await hydrator(id, session);
            if (
              !hydrated ||
              !(hydrated.__typename in this.resources.getEnhancedMap())
            ) {
              return null;
            }

            const resource = this.resources.getByName(hydrated.__typename);
            const perms = this.privileges.for(session, resource, hydrated).all;
            return matchedProps.some((key) =>
              // @ts-expect-error strict typing is hard for this dynamic use case.
              key in perms ? perms[key].read : true,
            )
              ? hydrated
              : null;
          },
        ),
    );
    const hydrated = maybeHydrated.filter(isNotNil);

    // It is possible that to have two different matches that end up resolving
    // to the same resource, so they need to be de-duped.
    // For example, a language name and ethnologue code are both matched,
    // but in hydrating we convert the ethnologue language to a regular language.
    // Only at this point can we check for this convergence.
    const items = uniqBy(hydrated, (result) => result.id);

    return {
      items: items.slice(0, input.count),
    };
  }

  private hydrate<K extends keyof SearchableMap>(type: K) {
    return async (
      ...args: Parameters<Hydrator<any>>
    ): Promise<SearchResult | null> => {
      const hydrator =
        type in this.customHydrators ? this.customHydrators[type] : undefined;
      try {
        const obj = hydrator
          ? await hydrator(...args)
          : await this.resourceResolver.lookup(type, ...args);
        return obj as SearchResult;
      } catch (err) {
        if (err instanceof NotFoundException) return null;
        else throw new ServerException(`Error searching on ${type}`, err);
      }
    };
  }
}
