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
  Organization,
  Country,
  Region,
  Zone,
  Language,
  TranslationProject,
  InternshipProject,
  User,
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

// __typename is a GQL thing to identify type at runtime
// It makes since to match this to not conflict with actual properties and
// to match what GQL does on the consuming side.
// eslint-disable-next-line @typescript-eslint/naming-convention
export type SearchItem<T, S> = T & { __typename: S };

export type SearchResult = {
  [K in keyof typeof searchable]: SearchItem<typeof searchable[K], K>;
}[keyof typeof searchable];

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
export const GqlSearchType = {
  ...searchable,
  ...searchableAbstracts,
};

registerEnumType(GqlSearchType, { name: 'SearchType' });
