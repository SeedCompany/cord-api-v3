import { Injectable } from '@nestjs/common';
import { node, regexp, relation } from 'cypher-query-builder';
import { compact } from 'lodash';
import { ISession } from '../../common';
import {
  DatabaseService,
  matchRequestingUser,
  matchUserPermissions,
} from '../../core';
import { FilmService } from '../film';
import { LanguageService } from '../language';
import { LiteracyMaterialService } from '../literacy-material';
import { LocationService } from '../location';
import { OrganizationService } from '../organization';
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
type Hydrator<R> = (id: string, session: ISession) => Promise<R>;

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
    Country: (...args) => this.location.readOneCountry(...args),
    Region: (...args) => this.location.readOneRegion(...args),
    Zone: (...args) => this.location.readOneZone(...args),
    Language: (...args) => this.language.readOne(...args),
    TranslationProject: (...args) => this.projects.readOneTranslation(...args),
    InternshipProject: (...args) => this.projects.readOneInternship(...args),
    Film: (...args) => this.film.readOne(...args),
    Story: (...args) => this.story.readOne(...args),
    LiteracyMaterial: (...args) => this.literacyMaterial.readOne(...args),
    Song: (...args) => this.song.readOne(...args),
  };
  /* eslint-enable @typescript-eslint/naming-convention */

  constructor(
    private readonly db: DatabaseService,
    private readonly users: UserService,
    private readonly orgs: OrganizationService,
    private readonly location: LocationService,
    private readonly language: LanguageService,
    private readonly projects: ProjectService,
    private readonly film: FilmService,
    private readonly story: StoryService,
    private readonly literacyMaterial: LiteracyMaterialService,
    private readonly song: SongService
  ) {}

  async search(input: SearchInput, session: ISession): Promise<SearchOutput> {
    // if type isn't specified default to all types
    const types = input.type || SearchResultTypes;

    // Search for nodes based on input, only returning their id and "type"
    // which is based on their first valid search label.
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions)
      .match([
        node('node'),
        relation('out', 'r', { active: true }),
        node('property', 'Property', { active: true }),
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
      .asResult<{ id: string; type: keyof SearchResultMap }>();

    const results = await query.run();

    // Individually convert each result (id & type) to its search result
    // based on this.hydrators
    const hydrated = await Promise.all(
      results.map(
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
      const obj = await hydrator(...args);
      return {
        ...obj,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        __typename: type,
      };
    };
  }
}
