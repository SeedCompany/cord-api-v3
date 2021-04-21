import { Injectable } from '@nestjs/common';
import { node, regexp, relation } from 'cypher-query-builder';
import { compact } from 'lodash';
import { ID, NotFoundException, ServerException, Session } from '../../common';
import {
  DatabaseService,
  matchRequestingUser,
  matchUserPermissions,
} from '../../core';
import { FieldRegionService } from '../field-region';
import { FieldZoneService } from '../field-zone';
import { FilmService } from '../film';
import { FundingAccountService } from '../funding-account';
import { LanguageService } from '../language';
import { LiteracyMaterialService } from '../literacy-material';
import { LocationService } from '../location';
import { OrganizationService } from '../organization';
import { PartnerService } from '../partner';
import { ProjectService } from '../project';
import { SongService } from '../song';
import { StoryService } from '../story';
import { UserService } from '../user';
import {
  SearchableMap,
  SearchInput,
  SearchOutput,
  SearchResult,
  SearchResultMap,
  SearchResultTypes,
} from './dto';

type HydratorMap = {
  [K in keyof SearchableMap]?: Hydrator<SearchableMap[K]>;
};
type Hydrator<R> = (id: ID, session: Session) => Promise<R>;

const labels = JSON.stringify(SearchResultTypes);
const typeFromLabels = `[l in labels(node) where l in ${labels}][0] as type`;

@Injectable()
export class SearchService {
  // mapping of base nodes to functions that,
  // given id & session, will return the object.
  /* eslint-disable @typescript-eslint/naming-convention */
  private readonly hydrators: HydratorMap = {
    Organization: (...args) => this.orgs.readOne(...args),
    User: (...args) => this.users.readOne(...args),
    Partner: (...args) => this.partners.readOne(...args),
    PartnerByOrg: (...args) => this.partners.readOnePartnerByOrgId(...args),
    Language: (...args) => this.language.readOne(...args),
    TranslationProject: (...args) => this.projects.readOneTranslation(...args),
    InternshipProject: (...args) => this.projects.readOneInternship(...args),
    Film: (...args) => this.film.readOne(...args),
    Story: (...args) => this.story.readOne(...args),
    LiteracyMaterial: (...args) => this.literacyMaterial.readOne(...args),
    Song: (...args) => this.song.readOne(...args),
    Location: (...args) => this.location.readOne(...args),
    FieldZone: (...args) => this.zone.readOne(...args),
    FieldRegion: (...args) => this.region.readOne(...args),
    FundingAccount: (...args) => this.fundingAccount.readOne(...args),
  };
  /* eslint-enable @typescript-eslint/naming-convention */

  constructor(
    private readonly db: DatabaseService,
    private readonly users: UserService,
    private readonly orgs: OrganizationService,
    private readonly partners: PartnerService,
    private readonly location: LocationService,
    private readonly language: LanguageService,
    private readonly projects: ProjectService,
    private readonly film: FilmService,
    private readonly story: StoryService,
    private readonly literacyMaterial: LiteracyMaterialService,
    private readonly song: SongService,
    private readonly zone: FieldZoneService,
    private readonly region: FieldRegionService,
    private readonly fundingAccount: FundingAccountService
  ) {}

  async search(input: SearchInput, session: Session): Promise<SearchOutput> {
    // if type isn't specified default to all types
    const inputTypes = input.type || SearchResultTypes;

    const types = [
      ...inputTypes,
      // Add Organization label when searching for Partners we can search for
      // Partner by organization name
      ...(inputTypes.includes('Partner') ? ['Organization'] : []),
    ];

    // Search for nodes based on input, only returning their id and "type"
    // which is based on their first valid search label.
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .apply(matchUserPermissions)
      .match([
        node('node'),
        relation('out', 'r', { active: true }),
        node('property', 'Property'),
      ])
      // reduce to nodes with a label of one of the specified types
      .raw('WHERE size([l in labels(node) where l in $types | 1]) > 0', {
        types,
      })
      .with(['node', 'property'])
      .where({
        property: { value: regexp(`.*${input.query}.*`, true) },
      })
      .returnDistinct(['node.id as id', typeFromLabels])
      .limit(input.count)
      .asResult<{ id: ID; type: keyof SearchResultMap }>();

    const results = await query.run();

    // Individually convert each result (id & type) to its search result
    // based on this.hydrators
    const hydrated = await Promise.all(
      results
        // Map Org results to Org & Partner results based on types asked for
        .flatMap((result) =>
          result.type !== 'Organization'
            ? result
            : [
                ...(inputTypes.includes('Organization') ? [result] : []),
                ...(inputTypes.includes('Partner')
                  ? // partner hydrator will need to handle id of org and partner
                    [{ id: result.id, type: 'PartnerByOrg' as const }]
                  : []),
              ]
        )
        .map(
          async ({ id, type }): Promise<SearchResult | null> => {
            const hydrator = this.hydrate(type);
            return await hydrator(id, session);
          }
        )
    );

    return {
      items: compact(hydrated),
    };
  }

  private hydrate<K extends keyof SearchableMap>(type: K | null) {
    return async (
      ...args: Parameters<Hydrator<any>>
    ): Promise<SearchResult | null> => {
      if (!type) {
        return null;
      }
      const hydrator = this.hydrators[type] as Hydrator<SearchResultMap[K]>;
      if (!hydrator) {
        return null;
      }
      try {
        const obj = await hydrator(...args);
        return {
          ...obj,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          __typename: type,
        };
      } catch (err) {
        if (err instanceof NotFoundException) return null;
        else throw new ServerException(`Error searching on ${type}`, err);
      }
    };
  }
}
