import { Policy, Role, variant } from '../util';

@Policy(
  [
    Role.Consultant,
    Role.ConsultantManager,
    Role.Controller,
    Role.ExperienceOperations,
    Role.FinancialAnalyst,
    Role.Fundraising,
    Role.Leadership,
    Role.LeadFinancialAnalyst,
  ],
  (r) => [
    [r.ProgressReportCommunityStory, r.ProgressReportHighlight].map((it) =>
      it.specifically((p) => [
        p.prompt.when(variant('published')).read,
        p.responses.when(variant('published')).read,
      ])
    ),
    r.StepProgress.when(variant('official')).read,
  ]
)
export class ViewProgressReportPolicy {}
