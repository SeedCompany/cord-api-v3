import { stripIndent } from 'common-tags';
import { DateTime } from 'luxon';
import { RequireExactlyOne } from 'type-fest';
import { ID } from './id-field';

interface ObjectViewTypeMap {
  active: true;
  deleted: true;
  changeset: ID;
  beforeChangeset: ID;
  asOf: DateTime;
}

export type ObjectView = RequireExactlyOne<ObjectViewTypeMap>;

export const labelForView = (label: string, view?: ObjectView) =>
  view?.deleted ? `Deleted_${label}` : label;

const generateLabels = (labels: string[], view: ObjectView) =>
  [...labels, ...(view.deleted ? labels.map((l) => 'Deleted_' + l) : [])]
    .map((label) => `'${label}'`)
    .join(',');

export const typenameForView = (
  labels: string[],
  view: ObjectView = { active: true },
  nodeVar = 'node'
) => stripIndent`
  replace(
    [l in labels(${nodeVar})
      where l in [${generateLabels(labels, view)}]][0],
    'Deleted_',
    ''
  )
`;

export const viewOfChangeset = (changeset?: ID): ObjectView =>
  changeset ? { changeset } : { active: true };
