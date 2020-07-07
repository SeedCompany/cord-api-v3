import { createUnionType, registerEnumType } from '@nestjs/graphql';
import { simpleSwitch } from '../../../common';
import { Language } from '../../language/dto';
import { Country, Location, Region, Zone } from '../../location/dto';
import { Organization } from '../../organization/dto';
import {
  InternshipProject,
  IProject,
  TranslationProject,
} from '../../project/dto';
import { User } from '../../user/dto';

// Expand this to add to searchable types / results
const searchable = {
  Organization: Organization.classType,
  Country: Country.classType,
  Region: Region.classType,
  Zone: Zone.classType,
  Language: Language.classType,
  TranslationProject: TranslationProject.classType,
  InternshipProject: InternshipProject.classType,
  User: User.classType,
} as const;

// Expand this to add more search types, but not result types.
// Only use if not a concrete type.
const searchableAbstracts = {
  Project: IProject,
  Location: Location,
} as const;

/*******************************************************************************
 * Everything below is based on objects above and should not need to be modified
 ******************************************************************************/

export type SearchableMap = {
  [K in keyof typeof searchable]: InstanceType<typeof searchable[K]>;
};

export const SearchResultTypes = Object.keys(searchable);

// __typename is a GQL thing to identify type at runtime
// It makes since to match this to not conflict with actual properties and
// to match what GQL does on the consuming side.
// eslint-disable-next-line @typescript-eslint/naming-convention
export type SearchItem<T, S> = T & { __typename: S };

export type SearchResultMap = {
  [K in keyof SearchableMap]: SearchItem<SearchableMap[K], K>;
};
export type SearchResult = SearchResultMap[keyof SearchableMap];

export const SearchResult = createUnionType({
  name: 'SearchResult',
  types: () => Object.values(searchable),
  resolveType: (value: SearchResult) =>
    simpleSwitch(value.__typename, searchable),
});

export type SearchType =
  | keyof typeof searchable
  | keyof typeof searchableAbstracts;

// Don't use outside of defining GQL schema
export const GqlSearchType = {
  ...searchable,
  ...searchableAbstracts,
};

registerEnumType(GqlSearchType, { name: 'SearchType' });
