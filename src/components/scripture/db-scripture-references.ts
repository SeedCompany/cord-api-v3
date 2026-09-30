import { type Range } from '~/common';

/**
 * Scripture references as the legacy graph returned them: a list of nodes whose
 * `properties` hold the verse range. Postgres stores `{ start, end }` lists
 * directly; `ScriptureReferenceService.parseList` accepts either shape.
 */
export type DbScriptureReferences = ReadonlyArray<{
  readonly properties: Range<number>;
}>;
