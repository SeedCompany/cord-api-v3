module ProgressReport::ProductProgress {
  type Step extending Mixin::Timestamped, Project::ContextAware {
    required report: default::ProgressReport;
    required product: default::Product;
    required variant: Variant;
    required step: Product::Step;
    constraint exclusive on ((.report, .product, .variant, .step));

    completed: float32;

    access policy CanSelectGeneratedFromAppPoliciesForStepProgress
    allow select using (
      (
        exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'StaffMember'} intersect (<default::User>(global default::currentUserId)).roles)
        or (
          default::Role.ConsultantManager in (<default::User>(global default::currentUserId)).roles
          and (
            .isMember
            or .sensitivity <= default::Sensitivity.Medium
          )
        )
        or (
          exists (<default::Role>{'Consultant', 'ConsultantManager'} intersect (<default::User>(global default::currentUserId)).roles)
          and .isMember
        )
        or (
          default::Role.FieldPartner in (<default::User>(global default::currentUserId)).roles
          and (
            .isMember
            and <str>.variant = 'partner'
          )
        )
        or (
          default::Role.Intern in (<default::User>(global default::currentUserId)).roles
          and .isMember
        )
        or (
          default::Role.Mentor in (<default::User>(global default::currentUserId)).roles
          and .isMember
        )
        or (
          exists (<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect (<default::User>(global default::currentUserId)).roles)
          and (
            (
              .isMember
              and <str>.variant = 'official'
            )
            or (
              .isMember
              and <str>.variant = 'partner'
            )
          )
        )
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForStepProgress
    allow insert using (
      default::Role.Administrator in (<default::User>(global default::currentUserId)).roles
    );

    access policy CanDeleteGeneratedFromAppPoliciesForStepProgress
    allow delete using (
      default::Role.Administrator in (<default::User>(global default::currentUserId)).roles
    );
  }

  type Summary {
    required report: default::ProgressReport;
    required period: Period;
    constraint exclusive on ((.report, .period));

    required planned: float32;
    required actual: float32;
  }

  scalar type Variant extending enum<
    Official,
    Partner
  >;
  scalar type Period extending enum<
    ReportPeriod,
    FiscalYearSoFar,
    Cumulative,
  >;
}
