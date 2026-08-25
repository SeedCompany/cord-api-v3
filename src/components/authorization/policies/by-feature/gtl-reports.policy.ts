import { Policy, Role } from '../util';

/**
 * Read access to GTL quarterly reports for the roles that already read the
 * Momentum equivalent, plus the Field Partner role — a Global Translation
 * Leader's on-the-ground supervisor holds it, and they need to see the report
 * they are being asked to sign off.
 *
 * Write access and the workflow transitions (including supervisor sign-off,
 * which the FPM may also execute) land with the workflow itself.
 */
@Policy(
  [
    Role.ProjectManager,
    Role.RegionalDirector,
    Role.FieldOperationsDirector,
    Role.FieldPartner,
    Role.Leadership,
  ],
  (r) => [r.GTLReport.read],
)
export class GtlReportsPolicy {}
