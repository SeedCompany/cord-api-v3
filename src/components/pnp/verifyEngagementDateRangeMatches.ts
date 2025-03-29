import { stripIndent } from 'common-tags';
import { DateTime } from 'luxon';
import { DateInterval } from '~/common';
import {
  PnpPlanningExtractionResult,
  PnpProblemType,
} from './extraction-result';
import { PlanningSheet } from './planning-sheet';

export function verifyEngagementDateRangeMatches(
  sheet: PlanningSheet,
  result: PnpPlanningExtractionResult,
  engagementRange: DateInterval | null,
) {
  let pnpRange;
  try {
    pnpRange = sheet.projectDateRange;
  } catch {
    // fall
  }

  const matches =
    engagementRange && pnpRange && engagementRange.equals(pnpRange);

  if (matches) {
    return true;
  }

  result.addProblem(
    MismatchedEngagementDateRange,
    sheet.projectDateCells.start,
    {
      eng: engagementRange?.toISO(),
      pnp: pnpRange?.toISO(),
    },
  );

  return false;
}

const MismatchedEngagementDateRange = PnpProblemType.register({
  name: 'MismatchedEngagementDateRange',
  severity: 'Error',
  render:
    (ctx: { eng?: string; pnp?: string }) =>
    ({ source }) => {
      const eng = ctx.eng ? DateInterval.fromISO(ctx.eng) : null;
      const pnp = ctx.pnp ? DateInterval.fromISO(ctx.pnp) : null;

      if (!eng) {
        return {
          message: stripIndent`
            This CORD Project (and Engagement) do not have dates declared.

            Please fill these out so that we can determine which PnP goals to
            include for this project.
          `,
        };
      }
      if (!pnp) {
        return {
          message: `Unable to identify one or both of the **project dates** in this PnP file \`${source}\``,
        };
      }
      return {
        message: stripIndent`
          The PnP's **project dates** (\`${source}\`) are different from what is declared in the CORD Engagement/Project.

          CORD: ${eng.toLocaleString(DateTime.DATE_MED)}
          PnP: ${pnp.toLocaleString(DateTime.DATE_MED)}

          Please adjust the dates in CORD or the PnP to match and be accurate.

          If this is a cluster project and this engagement ("language") has started late or ends early,
          that difference can be declared in CORD's _Engagement dates_.
        `.replaceAll(/\n/g, '  \n'), // keep line breaks with MD's two space trailers
      };
    },
});
