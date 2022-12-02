import { member, Policy, Role, variant } from '../util';

@Policy(Role.FieldPartner, (r) => [
  r.ProgressReport.when(member).edit,
  [r.ProgressReportCommunityStory, r.ProgressReportHighlight].flatMap((it) => [
    it.when(member).create.read,
    it.specifically((p) => [
      p.responses.whenAll(member, variant('translated')).read,
      p.responses.whenAll(member, variant('draft')).edit,
    ]),
  ]),
  r.StepProgress.whenAll(member, variant('partner')).edit,
])
export class FieldPartnerPolicy {}
