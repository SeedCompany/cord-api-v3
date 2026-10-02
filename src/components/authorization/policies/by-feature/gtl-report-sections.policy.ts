import { type ResourcesGranter } from '../../policy/granters';
import { member, Policy, Role, sensOnlyLow, variant } from '../util';

// Who may see and work the written sections of a GTL quarterly report
// (#3969): Community Impact and Highlights (prompt responses with the four
// audience variants), the Practicum list, and the confidential Explanation of
// Progress. One class per `@Policy`, since each decorator takes one role list.
//
// The two prompt-response sections copy Momentum's variant grants role for
// role (project-manager / field-partner / translator / marketing policies).
//
// Why each class also grants `r.GTLReport.children(...)`: the response lists
// are reached through the report's `communityImpact` / `highlights` edges, and
// the engine only DERIVES an edge grant from the child resource's own grants
// when the parent and the child are granted in the SAME policy. The report's
// own grants live in the by-role files, so a by-feature file has to name the
// edges itself — read-only on the report, and member-conditioned wherever the
// child's read is.
//
// Field Partner, Project Manager and Translator act on their OWN projects, so
// their grants are member-conditioned; Regional Director, Field Operations
// Director and Marketing oversee many projects and are not added as members,
// so theirs are global, matching the report's own grants.

const prose = (r: ResourcesGranter) => [
  r.GtlReportCommunityImpact,
  r.GtlReportHighlight,
];

@Policy(Role.FieldPartner, (r) => [
  r.GTLReport.when(member).children((c) => [
    c.communityImpact.read.create,
    c.highlights.read.create,
  ]),
  prose(r).flatMap((it) => [
    it.when(member).create.read,
    it.specifically((p) => [
      p.responses.whenAll(member, variant('translated')).read,
      p.responses.whenAll(member, variant('draft')).edit,
    ]),
  ]),
  r.GtlReportPracticum.when(member).read.create.edit.delete,
  // No grant on GtlProgressExplanation: the leader never sees their manager's
  // explanation, and the service answers `null` rather than a redacted shell.
])
export class GtlReportSectionsFieldPartnerPolicy {}

@Policy(Role.Translator, (r) => [
  r.GTLReport.when(member).children((c) => [
    c.communityImpact.read,
    c.highlights.read,
  ]),
  prose(r).flatMap((it) => [
    it.when(member).read,
    it.specifically((p) => [
      p.responses.whenAll(member, variant('draft')).read,
      p.responses.whenAll(member, variant('translated')).edit,
    ]),
  ]),
  r.GtlReportPracticum.when(member).read,
])
export class GtlReportSectionsTranslatorPolicy {}

@Policy(Role.ProjectManager, (r) => [
  r.GTLReport.children((c) => [
    c.communityImpact.read.when(member).create,
    c.highlights.read.when(member).create,
  ]),
  prose(r).flatMap((it) => [
    it.read,
    it.when(member).create,
    it.specifically((p) => [
      p.responses.whenAll(sensOnlyLow, variant('fpm', 'published')).read,
      p.responses.when(member).read,
      // Edits draft and translated too, matching Momentum.
      p.responses.whenAll(member, variant('draft', 'translated', 'fpm')).edit,
    ]),
  ]),
  r.GtlReportPracticum.when(member).read.create.edit.delete,
  r.GtlProgressExplanation.when(member).read.edit,
])
export class GtlReportSectionsProjectManagerPolicy {}

@Policy(Role.Marketing, (r) => [
  r.GTLReport.children((c) => [
    c.communityImpact.read.create,
    c.highlights.read.create,
  ]),
  prose(r).flatMap((it) => [
    it.create,
    it.read.specifically((p) => [
      p.responses.read.when(variant('published')).edit,
    ]),
  ]),
  r.GtlReportPracticum.read,
  // The status only — never the explanation itself. Mirrors Marketing's
  // comments-free read of the Progress Report's variance explanation.
  r.GtlProgressExplanation.specifically((p) => p.status.read),
])
export class GtlReportSectionsMarketingPolicy {}

@Policy([Role.RegionalDirector, Role.FieldOperationsDirector], (r) => [
  r.GtlReportPracticum.read,
  r.GtlProgressExplanation.read.edit,
])
export class GtlReportSectionsDirectorPolicy {}

// The published variant only, as Momentum's view-progress-report policy gives
// these roles. Leadership is listed for parity with that policy; in practice
// its `allowAll('read')` already reads every variant of every section — and
// the Explanation of Progress `context` with it. Accepted: Leadership reads
// everything by design.
@Policy(
  [Role.RegionalDirector, Role.FieldOperationsDirector, Role.Leadership],
  (r) => [
    r.GTLReport.children((c) => [c.communityImpact.read, c.highlights.read]),
    prose(r).map((it) =>
      it.read.specifically((p) => p.responses.when(variant('published')).read),
    ),
  ],
)
export class GtlReportProseViewPolicy {}
