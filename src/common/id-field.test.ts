/* eslint-disable @seedcompany/no-unused-vars */
import { test } from '@jest/globals';
import type { User } from '../components/user/dto';
import { ID } from './id-field';

test('only types here', () => undefined);

const NameFromSelf: ID<'User'> = '' as ID<'User'>;
const NameFromDB: ID<'User'> = '' as ID<'default::User'>;
const NameFromInstance: ID<'User'> = '' as ID<User>;
const NameFromStatic: ID<'User'> = '' as ID<typeof User>;

const NameToSelf: ID<'User'> = '' as ID<'User'>;
const NameToDB: ID<'default::User'> = '' as ID<'User'>;
const NameToInstance: ID<User> = '' as ID<'User'>;
const NameToStatic: ID<typeof User> = '' as ID<'User'>;

const NameFromAny: ID<'User'> = '' as ID;
const NameToAny: ID = '' as ID<'User'>;

const AnyStringWorks: ID<'asdf'> = '' as ID;
const AnyObjectWorks: ID<Date> = '' as ID;

// @ts-expect-error this should be blocked
const UserIncompatibleDifferent: ID<'User'> = '' as ID<'Location'>;
// @ts-expect-error this should be blocked
const UserIncompatibleDifferent2: ID<'Location'> = '' as ID<'User'>;

const SubclassesAreCompatible: ID<'Engagement'> =
  '' as ID<'LanguageEngagement'>;
// @ts-expect-error this should be blocked
const InterfaceIsNotDirectlyCompatibleWithConcrete: ID<'LanguageEngagement'> =
  '' as ID<'Engagement'>;
const ButCanBeTypeCastAsInterfaceOverlapsConcrete =
  '' as ID<'Engagement'> as ID<'LanguageEngagement'>;
// @ts-expect-error this should be blocked
const IndependentTypesCannotBeTypeCast = '' as ID<'Engagement'> as ID<'User'>;
