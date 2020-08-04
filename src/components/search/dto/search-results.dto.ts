import { createUnionType, registerEnumType } from '@nestjs/graphql';
import { mapValues } from 'lodash';
import { simpleSwitch } from '../../../common';
import { Film } from '../../film/dto';
import { Language } from '../../language/dto';
import { LiteracyMaterial } from '../../literacy-material/dto';
import { Country, Location, Region, Zone } from '../../location/dto';
import { Organization } from '../../organization/dto';
import {
  InternshipProject,
  IProject as Project,
  TranslationProject,
} from '../../project/dto';
import { Song } from '../../song/dto';
import { Story } from '../../story/dto';
import { User } from '../../user/dto';

// Expand this to add to searchable types / results
const searchable = {
  Organization,
  Country,
  Region,
  Zone,
  Language,
  TranslationProject,
  InternshipProject,
  User,
  Film,
  Story,
  LiteracyMaterial,
  Song,
} as const;

// Expand this to add more search types, but not result types.
// Only use if not a concrete type.
const searchableAbstracts = {
  Project,
  Location,
} as const;

/*******************************************************************************
 * Everything below is based on objects above and should not need to be modified
 ******************************************************************************/

export type SearchableMap = {
  [K in keyof typeof searchable]: typeof searchable[K]['prototype'];
};

export const SearchResultTypes = Object.keys(searchable);

// __typename is a GQL thing to identify type at runtime
// It makes since to match this to not conflict with actual properties and
// to match what GQL does on the consuming side.
export type SearchItem<T, S> = T & { __typename: S };

export type SearchResultMap = {
  [K in keyof SearchableMap]: SearchItem<SearchableMap[K], K>;
};
export type SearchResult = SearchResultMap[keyof SearchableMap];

export const SearchResult = createUnionType({
  name: 'SearchResult',
  types: () => Object.values(searchable) as any, // ignore errors for abstract classes
  resolveType: (value: SearchResult) =>
    simpleSwitch(value.__typename, searchable),
});

export type SearchType =
  | keyof typeof searchable
  | keyof typeof searchableAbstracts;

// Don't use outside of defining GQL schema
export const GqlSearchType = mapValues(
  {
    ...searchable,
    ...searchableAbstracts,
  },
  (v, k) => k
);

registerEnumType(GqlSearchType, { name: 'SearchType' });
