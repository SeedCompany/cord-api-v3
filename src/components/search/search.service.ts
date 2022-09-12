import { Injectable } from '@nestjs/common';
import { compact } from 'lodash';
import {
  has,
  ID,
  NotFoundException,
  ServerException,
  Session,
} from '../../common';
import { ResourceResolver } from '../../core';
import {
  AuthorizationService,
  Permission,
} from '../authorization/authorization.service';
import { ResourceMap } from '../authorization/model/resource-map';
import { LanguageService } from '../language';
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
    LanguageByEthnologueLanguage: async (...args) => ({
      ...(await this.languages.readOneLanguageByEthLangId(...args)),
      __typename: 'Language',
    }),
  };
  /* eslint-enable @typescript-eslint/naming-convention */

  constructor(
    private readonly resources: ResourceResolver,
    private readonly auth: AuthorizationService,
    private readonly languages: LanguageService,
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
      // Add EthnologueLanguage label when searching for Languages we can search for
      // Language by Eth Code and ROD
      ...(inputTypes.includes('Language')
        ? (['EthnologueLanguage'] as const)
        : []),
    ];

    // Search for nodes based on input, only returning their id and "type"
    // which is based on their first valid search label.
    const results = await this.repo.search({ ...input, type: types });

    // Individually convert each result (id & type) to its search result
    // based on this.hydrators
    const hydrated = await Promise.all(
      results
        .map(({ node, matchedProps }) => ({
          type: this.resources.resolveTypeByBaseNode(
            node
          ) as keyof SearchableMap,
          id: node.properties.id,
          matchedProps,
        }))
        // Map Org results to Org & Partner results based on types asked for
        // Map EthnologueLanguage results to EthnologueLanguage & Language results based on types asked for
        .flatMap((result) =>
          result.type !== 'Organization' && result.type !== 'EthnologueLanguage'
            ? result
            : [
                ...(inputTypes.includes('Organization') ||
                inputTypes.includes('EthnologueLanguage')
                  ? [result]
                  : []),
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
                // If matched EthnologueLanguage, include Language implicitly
                ...(inputTypes.includes('Language')
                  ? [
                      {
                        id: result.id, // hydrator knows this is an ethLang id not language
                        type: 'LanguageByEthnologueLanguage' as const,
                        matchedProps: ['ethnologueLanguage' as const],
                      },
                    ]
                  : []),
              ]
        )
        .map(
          async ({ id, matchedProps, type }): Promise<SearchResult | null> => {
            const hydrator = this.hydrate(type);
            const hydrated = await hydrator(id, session);
            if (!hydrated || !(hydrated.__typename in ResourceMap)) {
              return null;
            }

            const perms = await this.auth.getPermissions({
              resource: ResourceMap[hydrated.__typename],
              dto: hydrated,
              sessionOrUserId: session,
            });
            return matchedProps.some((key) =>
              has(key, perms) ? (perms[key] as Permission).canRead : true
            )
              ? hydrated
              : null;
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
        return obj as SearchResult;
      } catch (err) {
        if (err instanceof NotFoundException) return null;
        else throw new ServerException(`Error searching on ${type}`, err);
      }
    };
  }
}
