import { Injectable } from '@nestjs/common';
import { compact } from 'lodash';
import {
  ID,
  isSecured,
  NotFoundException,
  ServerException,
  Session,
} from '../../common';
import { ResourceResolver } from '../../core';
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
    PartnerByOrg: (...args) => this.partners.readOnePartnerByOrgId(...args),
  };
  /* eslint-enable @typescript-eslint/naming-convention */

  constructor(
    private readonly resources: ResourceResolver,
    private readonly partners: PartnerService,
    private readonly repo: SearchRepository
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

    // Individually convert each result (id & type) to its search result
    // based on this.hydrators
    const hydrated = await Promise.all(
      results
        .map(({ node, matchedProp }) => ({
          type: this.resources.resolveTypeByBaseNode(
            node
          ) as keyof SearchableMap,
          id: node.properties.id,
          matchedProp,
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
                        matchedProp: 'organization' as keyof SearchResult,
                      },
                    ]
                  : []),
              ]
        )
        .map(
          async ({ id, matchedProp, type }): Promise<SearchResult | null> => {
            const hydrator = this.hydrate(type);
            const hydrated = await hydrator(id, session);

            const prop = hydrated?.[matchedProp];
            const result = isSecured(prop) && !prop.canRead ? null : hydrated;
            return result;
          }
        )
    );

    return {
      items: compact(hydrated).slice(0, input.count),
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
        return {
          ...obj,
          // @ts-expect-error Not sure why TS is failing here.
          __typename: type,
        };
      } catch (err) {
        if (err instanceof NotFoundException) return null;
        else throw new ServerException(`Error searching on ${type}`, err);
      }
    };
  }
}
