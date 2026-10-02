import { type ID } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import { runAsAdmin } from './login';

export type ExecuteGtlReportTransitionInput = InputOf<
  typeof TransitionGtlReportDoc
>;
type Status = ExecuteGtlReportTransitionInput['bypassTo'] & {};

/** Jump the report straight to a status, as an administrator (workflow bypass). */
export const forceGtlReportTo = async (
  app: TestApp,
  report: ID,
  bypassTo: Status,
) =>
  await runAsAdmin(app, async () => {
    return await transitionGtlReport(app, { report, bypassTo });
  });

export const transitionGtlReport = async (
  app: TestApp,
  input: ExecuteGtlReportTransitionInput,
) => {
  const result = await app.graphql.mutate(TransitionGtlReportDoc, { input });
  return result.transitionGtlReport;
};

const gtlReportStatusFields = graphql(`
  fragment gtlReportStatusFields on SecuredGtlReportStatus {
    canRead
    canEdit
    value
    transitions {
      key
      label
      to
      type
      disabled
      disabledReason
    }
    canBypassTransitions
  }
`);

const TransitionGtlReportDoc = graphql(
  `
    mutation TransitionGtlReport($input: ExecuteGtlReportTransition!) {
      transitionGtlReport(input: $input) {
        id
        status {
          ...gtlReportStatusFields
        }
      }
    }
  `,
  [gtlReportStatusFields],
);

export const getGtlReportTransitions = async (app: TestApp, report: ID) => {
  const result = await app.graphql.query(
    graphql(
      `
        query GtlReportTransitions($report: ID!) {
          periodicReport(id: $report) {
            __typename
            ... on GTLReport {
              id
              status {
                ...gtlReportStatusFields
              }
            }
          }
        }
      `,
      [gtlReportStatusFields],
    ),
    { report },
  );
  const found = result.periodicReport;
  if (found.__typename !== 'GTLReport') {
    throw new Error(
      `Report ${report} is a ${found.__typename}, not a GTLReport`,
    );
  }
  return found;
};
