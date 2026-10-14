import { getTableColumns, is } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import * as schema from '~/core/drizzle/schema';

/**
 * Scrub classification — the single source of truth for what a production copy
 * is allowed to expose.
 *
 * WHY THIS FILE IS AN ALLOWLIST. A blocklist silently leaks whatever you forgot
 * and never tells you. This file instead names every table in the Drizzle
 * schema (the type of {@link classification} does not compile otherwise) and
 * every column that can hold free text — text, varchar, json/jsonb and text
 * arrays — that is not a primary key, a foreign key or an enum.
 * `classification.spec.ts` walks the schema and fails on anything unlisted, so
 * a new column cannot ship without a decision. The scrub repeats the same check
 * at run time, and ALSO compares the live database against the schema, so a
 * dump taken from a newer production than the code knows about is refused too.
 *
 * `review` entries also block. An unanswered question is not a default to
 * `safe`.
 *
 * Two further rules the scrub itself enforces, recorded here because they are
 * easy to lose:
 *  - Replace, never blank. Several of these columns carry partial unique
 *    indexes, so fakes must be valid, unique where the original was unique, and
 *    of comparable length. Rich text keeps its document structure; only the
 *    words inside change.
 *  - Deterministic, never random. The same input must always produce the same
 *    fake, so monthly refreshes stay stable (a person keeps their fake name, so
 *    bookmarks and screenshots still make sense) and two runs stay comparable.
 */

/**
 * Entity names drawn from the reviewed pools in `theme.ts`, keyed by TYPE so
 * each gets its own pool and (where a unique index demands it) its own
 * registry. See `entity-name.ts` for the registry/hash split.
 */
export type ThemedNameStrategy =
  | 'projectName'
  | 'organizationName'
  | 'locationName'
  | 'fieldZoneName'
  | 'fieldRegionName'
  | 'fundingAccountName'
  | 'toolName'
  | 'filmName'
  | 'storyName'
  | 'ethnoArtName'
  | 'languageName'
  | 'fileName'
  | 'directoryName';

/** Strategies `fakeValue` in `fake.ts` can produce on its own, per value. */
export type PlainStrategy =
  /** One name from the reviewed given-name pool, keyed per record. */
  | 'givenName'
  /** One name from the reviewed surname pool, keyed per record. */
  | 'surname'
  /** `<handle>.<tag>@example.invalid` — RFC 2606 reserved, never routable. */
  | 'email'
  /** The 555-01xx fictional block. */
  | 'phone'
  | 'address'
  /** Generated sentences of comparable length. */
  | 'prose'
  /** `prose` plus a digest tag, for columns under a unique index. */
  | 'uniqueProse'
  /** A jsonb block-editor document: same blocks, same ids, new words. */
  | 'richText'
  /** A generated company-style name plus a digest tag — unique, untitled. */
  | 'entityName'
  /** Uppercase letters of the same length. */
  | 'acronym'
  /** Replaced with the hash of `SCRUB_DEV_PASSWORD`, so the copy can be logged into. */
  | 'credential'
  /** Hash-assigned from the language pool; `name` and `display_name` stay equal. */
  | 'languageName';

export type Strategy = PlainStrategy | ThemedNameStrategy;

export type ColumnAction =
  /** Ids and type discriminators that reference other rows. Nothing to scrub. */
  | { readonly kind: 'structural'; readonly why?: string }
  /** Holds no personal or narrative content. Say why. */
  | { readonly kind: 'safe'; readonly why: string }
  | { readonly kind: 'scrub'; readonly as: Strategy; readonly note?: string }
  /**
   * The strategy depends on another column of the same row — `file_nodes.name`
   * is a file name or a folder name according to `type`. Every value of that
   * enum must be routed, which the spec enforces.
   */
  | {
      readonly kind: 'perType';
      readonly by: string;
      readonly types: Readonly<Record<string, ThemedNameStrategy>>;
      readonly note?: string;
    }
  | { readonly kind: 'review'; readonly question: string };

type Schema = typeof schema;

/** Every `pgTable` export of the schema, by export name. */
export type TableKey = {
  [K in keyof Schema]: Schema[K] extends PgTable ? K : never;
}[keyof Schema];

type ColumnKey<T extends TableKey> = keyof Schema[T]['_']['columns'] & string;

export type TableAction<T extends TableKey = TableKey> =
  /** The whole table is emptied. Say why. */
  | { readonly truncate: string }
  | {
      readonly columns: { readonly [C in ColumnKey<T>]?: ColumnAction };
    };

const structural: ColumnAction = { kind: 'structural' };
const safe = (why: string): ColumnAction => ({ kind: 'safe', why });
const scrub = (as: Strategy, note?: string): ColumnAction => ({
  kind: 'scrub',
  as,
  ...(note && { note }),
});
const perType = (
  by: string,
  types: Readonly<Record<string, ThemedNameStrategy>>,
  note?: string,
): ColumnAction => ({ kind: 'perType', by, types, ...(note && { note }) });

/**
 * Columns that are keys or enums are structural by construction and need no
 * entry. Listing one anyway is allowed (the polymorphic `parent_id` columns
 * are, so a reader sees them decided) — the spec only refuses entries for
 * columns that do not exist.
 */
export const classification: { readonly [T in TableKey]: TableAction<T> } = {
  // ─── People ──────────────────────────────────────────────────────────────
  users: {
    columns: {
      email: scrub(
        'email',
        'plain UNIQUE index — the tag keeps fakes distinct',
      ),
      realFirstName: scrub('givenName'),
      realLastName: scrub('surname'),
      displayFirstName: scrub('givenName'),
      displayLastName: scrub('surname'),
      phone: scrub('phone'),
      timezone: safe('IANA zone name'),
      about: scrub('prose'),
      title: scrub('prose'),
      photoId: structural,
    },
  },
  userGlobalRoles: {
    columns: { role: safe('Role enum stored as text') },
  },
  educations: {
    columns: {
      major: scrub('prose'),
      institution: scrub('prose'),
    },
  },
  unavailabilities: {
    columns: { description: scrub('prose') },
  },
  knownLanguages: { columns: {} },
  userLocations: { columns: {} },
  userOrganizations: { columns: {} },
  systemAgents: {
    columns: {
      // DECIDED 2026-10-14: the app looks these up BY NAME ('Ghost',
      // 'Anonymous', 'External Mailing Group'). The old scrubber themed them
      // and broke every system-agent lookup on the copy.
      name: safe('application constants, looked up by name at boot'),
      roles: safe('Role enum values'),
    },
  },

  // ─── Auth and secrets — emptied, never faked ─────────────────────────────
  authSessions: { truncate: 'live session tokens' },
  authPasswordResetTokens: {
    truncate: 'live reset tokens and the emails they went to',
  },
  authIdentities: {
    columns: {
      passwordHash: scrub(
        'credential',
        'every account gets the hash of SCRUB_DEV_PASSWORD',
      ),
    },
  },
  webhooks: { truncate: 'user-registered URLs, subscriptions and variables' },
  webhookExecutors: { truncate: 'signing secrets' },
  webhookChannelObservations: { truncate: 'follows webhooks' },
  broadcastChannels: {
    truncate:
      'channel names derive from webhook subscriptions and are orphan-cleaned by the app',
  },
  // DECIDED 2026-10-14 (plan default): the audit trail's `changes` jsonb holds
  // a before/after of every scrubbed field. Scrubbing inside it means
  // re-applying every rule to nested JSON; the history has no dev-time use.
  resourceMutations: {
    truncate: 'audit trail with before/after of every field',
  },

  // ─── Places and organizations (names are unique → registries) ────────────
  locations: {
    columns: {
      name: scrub('locationName'),
      isoAlpha3: safe('ISO country code'),
      mapImageId: structural,
    },
  },
  organizations: {
    columns: {
      name: scrub('organizationName'),
      acronym: scrub('acronym'),
      address: scrub('address'),
    },
  },
  organizationLocations: { columns: {} },
  fieldZones: { columns: { name: scrub('fieldZoneName') } },
  fieldRegions: { columns: { name: scrub('fieldRegionName') } },
  fundingAccounts: { columns: { name: scrub('fundingAccountName') } },
  departmentIdBlocks: { columns: {} },
  externalDepartmentIds: {
    columns: {
      departmentId: safe('finance system code'),
      name: scrub('entityName', 'department names from the finance system'),
    },
  },
  partners: {
    columns: {
      pmcEntityCode: safe('internal finance code'),
      address: scrub('address'),
      languageOfWiderCommunicationId: structural,
      languageOfReportingId: structural,
    },
  },
  partnerFieldRegions: { columns: {} },
  partnerCountries: { columns: {} },
  partnerLanguagesOfConsulting: { columns: {} },
  financialApprovers: { columns: {} },

  // ─── Languages ───────────────────────────────────────────────────────────
  languages: {
    columns: {
      name: scrub('languageName'),
      displayName: scrub(
        'languageName',
        'keyed on the value so name == display_name survives',
      ),
      displayNamePronunciation: scrub('prose'),
      registryOfLanguageVarietiesCode: safe(
        'ROLV code (Rob 2026-07-31: leave codes)',
      ),
      signLanguageCode: safe('code'),
      leastOfTheseReason: scrub('prose'),
      tags: safe('closed vocabulary: Bibleless, SignLanguage, Focus200, …'),
    },
  },
  ethnologueLanguages: {
    columns: {
      code: safe('Ethnologue code'),
      provisionalCode: safe('Ethnologue code'),
      name: scrub('languageName'),
    },
  },
  languageLocations: { columns: {} },

  // ─── Projects ────────────────────────────────────────────────────────────
  projects: {
    columns: {
      name: scrub('projectName'),
      rev79ProjectId: safe('opaque external id'),
      departmentId: safe('finance system code'),
      tags: safe('closed vocabulary: FieldManaged, ReportRequired, …'),
    },
  },
  projectMembers: { columns: {} },
  projectOtherLocations: { columns: {} },
  projectWorkflowEvents: {
    columns: {
      who: structural,
      transitionKey: safe('workflow transition identifier'),
      notes: scrub('richText'),
    },
  },
  budgets: {
    // Ids without a `.references()` in the Drizzle schema still name rows.
    columns: { universalTemplateFileId: structural },
  },
  budgetRecords: { columns: {} },
  partnerships: { columns: { mouId: structural, agreementId: structural } },
  partnershipProducingMediums: { columns: {} },
  ceremonies: { columns: {} },

  // ─── Engagements and products ────────────────────────────────────────────
  engagements: {
    columns: {
      description: scrub('richText'),
      paratextRegistryId: safe('opaque external id'),
      rev79CommunityId: safe('opaque external id'),
      pnpId: safe('opaque external id'),
      webId: safe('opaque external id'),
      historicGoal: scrub('prose'),
      position: safe('InternshipPosition enum stored as text'),
      growthPlanId: structural,
    },
  },
  engagementStatusHistory: { columns: {} },
  products: {
    columns: {
      title: scrub('prose'),
      description: scrub('prose'),
      describeCompletion: scrub('prose'),
      placeholderDescription: scrub('prose'),
      unspecifiedScriptureBook: safe('Bible book name'),
      scriptureReferences: safe('book/chapter/verse ranges'),
      scriptureReferencesOverride: safe('book/chapter/verse ranges'),
    },
  },
  producibles: {
    columns: {
      // Uniqueness is per type (`producibles_type_name_active_unique`), so each
      // type gets its own registry over one shared vocabulary.
      name: perType('type', {
        Film: 'filmName',
        Story: 'storyName',
        EthnoArt: 'ethnoArtName',
      }),
      scriptureReferences: safe('book/chapter/verse ranges'),
    },
  },
  productProgress: { columns: { variant: safe('variant key') } },
  stepProgress: { columns: {} },
  productCompletionDescriptions: {
    columns: {
      // DECIDED 2026-10-14: free text users typed about how a product is
      // "complete" (sampled: scripture ranges, print runs, Portuguese story
      // titles). Under a unique index with `methodology`, and short values
      // would collide as plain prose — hence the tag.
      value: scrub('uniqueProse'),
    },
  },
  toolUsages: {
    columns: {
      containerId: structural,
      containerType: structural,
    },
  },
  tools: {
    columns: {
      name: scrub('toolName'),
      description: scrub('prose'),
    },
  },

  // ─── Reports ─────────────────────────────────────────────────────────────
  periodicReports: {
    columns: {
      skippedReason: scrub('prose'),
      reportFileId: structural,
      narrativeFileId: structural,
    },
  },
  progressSummaries: { columns: {} },
  progressReportVarianceExplanations: {
    columns: {
      reasons: safe('closed list of reason sentences from the UI'),
      comments: scrub('richText'),
    },
  },
  progressReportWorkflowEvents: {
    columns: {
      who: structural,
      transitionKey: safe('workflow transition identifier'),
      notes: scrub('richText'),
    },
  },
  progressReportMedia: {
    columns: {
      variant: safe('variant key'),
      variantGroupId: structural,
      fileId: structural,
    },
  },
  promptVariantResponses: {
    columns: {
      resourceType: structural,
      parentId: structural,
      prompt: safe('prompt key — 5 distinct values'),
    },
  },
  promptVariantResponseEntries: {
    columns: {
      variant: safe('variant key'),
      response: scrub('richText'),
    },
  },
  pnpExtractionResults: { columns: {} },
  pnpExtractionResultProblems: {
    columns: {
      type: safe('problem template id'),
      source: safe('spreadsheet cell reference, e.g. Planning!W49'),
      // DECIDED 2026-10-14, continuing the 2026-07-31 decision: left in place.
      // The keys, measured on the 2026-09-09 copy (882k rows): step, goal,
      // fiscalYear, completed, bookRef, bookName, eng, pnp, label, goalVal,
      // noteRef, declVerseCount, declVerseRef, noteVal, noteVerseCount,
      // yearRef, reportDate, pnpDate, bookVal, verseRef, verseVal,
      // actualVerseCount. They hold step labels, Bible book and story names,
      // date ranges, cell references and verse counts; the longest value is
      // 242 characters. The verify pass keeps a watchlist on any value over
      // 200 characters so free text riding along would show up as a count.
      context: safe(
        'spreadsheet cell contents: step labels, book names, dates',
      ),
    },
  },

  // ─── Files and media ─────────────────────────────────────────────────────
  fileNodes: {
    columns: {
      // A FileVersion takes the same strategy as its File so the versions of
      // one document keep sharing its name. Hash-assigned, not registry: the
      // only uniqueness rule is per directory (file.service.ts).
      name: perType('type', {
        File: 'fileName',
        FileVersion: 'fileName',
        Directory: 'directoryName',
      }),
      mimeType: safe('media type'),
    },
  },
  media: {
    columns: {
      mimeType: safe('media type'),
      altText: scrub('prose'),
      caption: scrub('prose'),
    },
  },

  // ─── Conversation ────────────────────────────────────────────────────────
  commentThreads: {
    columns: {
      parentId: structural,
      parentType: structural,
    },
  },
  comments: { columns: { body: scrub('richText') } },
  posts: {
    columns: {
      parentId: structural,
      parentType: structural,
      body: scrub('prose', 'plain text in Postgres'),
    },
  },
  pins: { columns: { resourceId: structural } },
  notifications: { columns: { message: scrub('prose') } },
  notificationRecipients: { columns: {} },
};

export const isTruncate = (
  action: TableAction,
): action is { readonly truncate: string } => 'truncate' in action;

/**
 * A kept table's decisions by column key. The union of every table's
 * strongly typed column map has no keys in common, so run-time walks read it
 * through this loosely typed view instead.
 */
export const columnsOf = (
  action: TableAction,
): Readonly<Record<string, ColumnAction | undefined>> =>
  isTruncate(action) ? {} : action.columns;

// ─── The schema walk the spec and the run-time guard share ──────────────────

const TEXT_TYPES: ReadonlySet<string> = new Set([
  'PgText',
  'PgVarchar',
  'PgChar',
]);
const JSON_TYPES: ReadonlySet<string> = new Set(['PgJsonb', 'PgJson']);

export interface SchemaColumn {
  /** TypeScript property name — what {@link classification} is keyed on. */
  readonly key: string;
  /** Database column name — what SQL is written with. */
  readonly name: string;
  readonly columnType: string;
  /** Member of the primary key or of a foreign key. */
  readonly isKey: boolean;
  readonly enumValues: readonly string[] | undefined;
  readonly isText: boolean;
  readonly isJson: boolean;
  readonly isTextArray: boolean;
}

export interface SchemaTable {
  readonly key: TableKey;
  readonly name: string;
  readonly columns: readonly SchemaColumn[];
}

interface DrizzleColumnLike {
  readonly name: string;
  readonly columnType: string;
  readonly primary: boolean;
  readonly enumValues?: readonly string[];
  readonly baseColumn?: DrizzleColumnLike;
}

export const walkSchema = (): readonly SchemaTable[] =>
  (Object.keys(schema) as ReadonlyArray<keyof Schema>)
    .flatMap((key): SchemaTable[] => {
      const value: unknown = schema[key];
      if (!is(value, PgTable)) return [];
      const config = getTableConfig(value);
      const keyColumns = new Set<string>([
        ...config.primaryKeys.flatMap((pk) => pk.columns.map((c) => c.name)),
        ...config.foreignKeys.flatMap((fk) =>
          fk.reference().columns.map((c) => c.name),
        ),
      ]);
      const columns = Object.entries(getTableColumns(value)).map(
        ([columnKey, raw]): SchemaColumn => {
          const column = raw as unknown as DrizzleColumnLike;
          return {
            key: columnKey,
            name: column.name,
            columnType: column.columnType,
            isKey: column.primary || keyColumns.has(column.name),
            enumValues:
              column.columnType === 'PgEnumColumn'
                ? column.enumValues
                : undefined,
            isText: TEXT_TYPES.has(column.columnType),
            isJson: JSON_TYPES.has(column.columnType),
            isTextArray:
              column.columnType === 'PgArray' &&
              TEXT_TYPES.has(column.baseColumn?.columnType ?? ''),
          };
        },
      );
      return [{ key: key as TableKey, name: config.name, columns }];
    })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

/** A column that must carry an entry: free-text capable and not structural. */
export const needsDecision = (column: SchemaColumn): boolean =>
  (column.isText || column.isJson || column.isTextArray) &&
  !column.isKey &&
  column.enumValues === undefined;

export const columnActionsOf = (
  table: SchemaTable,
): ReadonlyArray<readonly [SchemaColumn, ColumnAction]> => {
  const action = classification[table.key];
  if (isTruncate(action)) return [];
  return Object.entries(columnsOf(action)).flatMap(([key, columnAction]) => {
    const column = table.columns.find((c) => c.key === key);
    return column && columnAction ? [[column, columnAction] as const] : [];
  });
};

/**
 * Every way the classification can disagree with the schema, as a list of
 * human-readable problems. Empty means the scrub may run.
 *
 * Reports the WHOLE list rather than throwing on the first, for the same reason
 * `findPoolShortfalls` does: each problem found on a freshly restored copy
 * costs a re-run to discover the next one.
 */
export const auditClassification = (): readonly string[] =>
  auditAgainst(classification, walkSchema());

/** {@link auditClassification} with both sides injectable, so the spec can prove it refuses. */
export const auditAgainst = (
  decisions: Readonly<Partial<Record<string, TableAction>>>,
  tables: readonly SchemaTable[],
): readonly string[] => {
  const problems: string[] = [];
  const known = new Set<string>(tables.map((t) => t.key));
  for (const key of Object.keys(decisions)) {
    if (!known.has(key)) {
      problems.push(`table "${key}" is classified but not in the schema`);
    }
  }
  for (const table of tables) {
    const action = decisions[table.key];
    if (!action) {
      problems.push(`table "${table.name}" has no classification`);
      continue;
    }
    if (isTruncate(action)) continue;
    const columns = columnsOf(action);

    for (const [key, columnAction] of Object.entries(columns)) {
      const column = table.columns.find((c) => c.key === key);
      if (!column) {
        problems.push(
          `${table.name}: column "${key}" is classified but does not exist`,
        );
        continue;
      }
      if (!columnAction) continue;
      const at = `${table.name}.${column.name}`;
      switch (columnAction.kind) {
        case 'review':
          problems.push(
            `${at} is still marked for review: ${columnAction.question}`,
          );
          break;
        case 'scrub':
          if (column.isTextArray) {
            problems.push(
              `${at}: arrays cannot be scrubbed (classify as safe, or split the column)`,
            );
          } else if (columnAction.as === 'richText' && !column.isJson) {
            problems.push(`${at}: richText is only for json/jsonb columns`);
          } else if (columnAction.as !== 'richText' && column.isJson) {
            problems.push(
              `${at}: a json/jsonb column can only be scrubbed as richText`,
            );
          } else if (!column.isText && !column.isJson) {
            problems.push(`${at}: only text and json columns can be scrubbed`);
          }
          break;
        case 'perType': {
          const by = table.columns.find((c) => c.key === columnAction.by);
          if (!by?.enumValues) {
            problems.push(
              `${at}: perType must route on an enum column; "${columnAction.by}" is not one`,
            );
            break;
          }
          if (!column.isText) {
            problems.push(`${at}: perType is only for text columns`);
          }
          for (const value of by.enumValues) {
            if (!(value in columnAction.types)) {
              problems.push(`${at}: ${by.name} = '${value}' is not routed`);
            }
          }
          for (const value of Object.keys(columnAction.types)) {
            if (!by.enumValues.includes(value)) {
              problems.push(
                `${at}: routes ${by.name} = '${value}', which the enum does not have`,
              );
            }
          }
          break;
        }
        case 'structural':
        case 'safe':
          break;
      }
    }

    for (const column of table.columns) {
      if (!needsDecision(column)) continue;
      if (!(column.key in columns)) {
        problems.push(
          `${table.name}.${column.name} (${column.columnType}) is not classified`,
        );
      }
    }
  }
  return problems;
};
