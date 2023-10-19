import { Injectable } from '@nestjs/common';
import { isNotFalsy } from '@seedcompany/common';
import { ID, NotFoundException, ServerException, Session } from '~/common';
import { ResourceResolver, ResourcesHost } from '~/core';
import { Privileges } from '../authorization';
import { PartnerService } from '../partner';
import {
  SearchableMap,
  SearchInput,
  SearchOutput,
  SearchResult,
  SearchResultMap,
  SearchResultTypes,
} from './dto';
import { SearchRepository } from './search.repository';

type HydratorMap = {
  [K in keyof SearchableMap]?: Hydrator<SearchableMap[K]>;
};
type Hydrator<R> = (id: ID, session: Session) => Promise<R>;

@Injectable()
export class SearchService {
  // mapping of base nodes to functions that,
  // given id & session, will return the object.
  /* eslint-disable @typescript-eslint/naming-convention */
  private readonly hydrators: HydratorMap = {
    PartnerByOrg: async (...args) => ({
      ...(await this.partners.readOnePartnerByOrgId(...args)),
      __typename: 'Partner',
    }),
  };
  /* eslint-enable @typescript-eslint/naming-convention */

  constructor(
    private readonly resourceHost: ResourcesHost,
    private readonly resources: ResourceResolver,
    private readonly privileges: Privileges,
    private readonly partners: PartnerService,
    private readonly repo: SearchRepository,
  ) {}

  async search(input: SearchInput, session: Session): Promise<SearchOutput> {
    // if type isn't specified default to all types
    const inputTypes = input.type || SearchResultTypes;

    const types = [
      ...inputTypes,
      // Add Organization label when searching for Partners we can search for
      // Partner by organization name
      ...(inputTypes.includes('Partner') ? (['Organization'] as const) : []),
    ];

    // Search for nodes based on input, only returning their id and "type"
    // which is based on their first valid search label.
    const results = await this.repo.search({ ...input, type: types });

    const ResourceMap = await this.resourceHost.getMap();

    // Individually convert each result (id & type) to its search result
    // based on this.hydrators
    const hydrated = await Promise.all(
      results
        .map(({ node, matchedProps }) => ({
          type: this.resources.resolveTypeByBaseNode(
            node,
          ) as keyof SearchableMap,
          id: node.properties.id,
          matchedProps,
        }))
        // Map Org results to Org & Partner results based on types asked for
        .flatMap((result) =>
          result.type !== 'Organization'
            ? result
            : [
                ...(inputTypes.includes('Organization') ? [result] : []),
                // If matched Organization, include Partner implicitly
                ...(inputTypes.includes('Partner')
                  ? [
                      {
                        id: result.id, // hydrator knows this is an org id not partner
                        type: 'PartnerByOrg' as const,
                        matchedProps: ['organization' as const],
                      },
                    ]
                  : []),
              ],
        )
        .map(
          async ({ id, matchedProps, type }): Promise<SearchResult | null> => {
            const hydrator = this.hydrate(type);
            const hydrated = await hydrator(id, session);
            if (!hydrated || !(hydrated.__typename in ResourceMap)) {
              return null;
            }

            const resource = await this.resourceHost.getByName(
              hydrated.__typename,
            );
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

    return {
      items: hydrated.filter(isNotFalsy).slice(0, input.count),
    };
  }

  private hydrate<K extends keyof SearchableMap>(type: K) {
    return async (
      ...args: Parameters<Hydrator<any>>
    ): Promise<SearchResult | null> => {
      const hydrator = this.hydrators[type] as Hydrator<SearchResultMap[K]>;
      try {
        const obj = hydrator
          ? await hydrator(...args)
          : await this.resources.lookup(type, ...args);
        return obj as SearchResult;
      } catch (err) {
        if (err instanceof NotFoundException) return null;
        else throw new ServerException(`Error searching on ${type}`, err);
      }
    };
  }
}
