import { createUnionType, registerEnumType } from '@nestjs/graphql';
import { mapValues, uniq } from 'lodash';
import { keys, simpleSwitch } from '../../../common';
import { ResourceMap } from '../../authorization/model/resource-map';
import { EthnoArt } from '../../ethno-art/dto';
import { FieldRegion } from '../../field-region/dto';
import { FieldZone } from '../../field-zone/dto';
import { Film } from '../../film/dto';
import { FundingAccount } from '../../funding-account/dto';
import { Language } from '../../language/dto';
import { LiteracyMaterial } from '../../literacy-material/dto';
import { Location } from '../../location/dto';
import { Organization } from '../../organization/dto';
import { Partner } from '../../partner/dto';
import {
  FinancialReport,
  NarrativeReport,
  IPeriodicReport as PeriodicReport,
  ProgressReport,
} from '../../periodic-report/dto';
import {
  DerivativeScriptureProduct,
  DirectScriptureProduct,
  OtherProduct,
  Product,
} from '../../product/dto';
import {
  InternshipProject,
  IProject as Project,
  TranslationProject,
} from '../../project/dto';
import { Song } from '../../song/dto';
import { Story } from '../../story/dto';
import { User } from '../../user/dto';

// A mapping of searchable types to their results. Expand as needed.
// Keys become the SearchType enum. Values become the SearchResult union.
// The keys should match DB "base-node" labels.
const publicSearchable = {
  Organization,
  Partner,
  Language,
  TranslationProject,
  InternshipProject,
  User,
  Film,
  Story,
  EthnoArt,
  LiteracyMaterial,
  Song,
  Location,
  FieldZone,
  FieldRegion,
  FundingAccount,
  DirectScriptureProduct,
  DerivativeScriptureProduct,
  OtherProduct,
  ProgressReport,
  FinancialReport,
  NarrativeReport,
} as const;

// Same as above, but the keys are ignored from the SearchType enum,
// since they are expected to be used only for internal use.
const privateSearchable = {
  PartnerByOrg: Partner,
} as const;

// Expand this to add more search types, but not result types.
// Only use if not a concrete type.
const searchableAbstracts = {
  Project,
  Product,
  PeriodicReport,
} as const;

/*******************************************************************************
 * Everything below is based on objects above and should not need to be modified
 ******************************************************************************/

const searchable = { ...publicSearchable, ...privateSearchable };

export type SearchableMap = {
  [K in keyof typeof searchable]: SearchItem<
    typeof searchable[K]['prototype'],
    keyof ResourceMap
  >;
};

export const SearchResultTypes = keys(publicSearchable);

// __typename is a GQL thing to identify type at runtime
// It makes sense to use this key to not conflict with actual properties and
// to match what GQL does on the consuming side.
export type SearchItem<T, S> = T & { __typename: S };

export type SearchResultMap = {
  [K in keyof SearchableMap]: SearchItem<SearchableMap[K], K>;
};
export type SearchResult = SearchResultMap[keyof SearchableMap];

export const SearchResult = createUnionType({
  name: 'SearchResult',
  // @ts-expect-error ignore errors for abstract classes
  types: () => uniq(Object.values(searchable)),
  resolveType: (value: SearchResult) =>
    simpleSwitch(value.__typename, searchable),
});

export type SearchType =
  | keyof typeof publicSearchable
  | keyof typeof searchableAbstracts;

// Don't use outside of defining GQL schema
export const GqlSearchType = mapValues(
  {
    ...publicSearchable,
    ...searchableAbstracts,
  },
  (v, k) => k
);

registerEnumType(GqlSearchType, { name: 'SearchType' });
