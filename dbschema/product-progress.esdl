module ProgressReport::ProductProgress {
  type Step extending Mixin::Timestamped, Project::ContextAware {
    required report: default::ProgressReport;
    required product: default::Product;
    required variant: Variant;
    required step: Product::Step;
    constraint exclusive on ((.report, .product, .variant, .step));

    completed: float32;

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForStepProgress
    allow select, update read using (
      (
        exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'StaffMember'} intersect global default::currentRoles)
        or (
          default::Role.FieldPartner in global default::currentRoles
          and .isMember
          and <str>.variant = 'partner'
        )
        or (
          exists (<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect global default::currentRoles)
          and .isMember
          and <str>.variant in {'official', 'partner'}
        )
        or (
          default::Role.ConsultantManager in global default::currentRoles
          and (
            .isMember
            or .sensitivity <= default::Sensitivity.Medium
          )
        )
        or (
          exists (<default::Role>{'Consultant', 'ConsultantManager', 'Intern', 'Mentor'} intersect global default::currentRoles)
          and .isMember
        )
      )
    );

    access policy CanUpdateWriteGeneratedFromAppPoliciesForStepProgress
    allow update write;

    access policy CanInsertDeleteGeneratedFromAppPoliciesForStepProgress
    allow insert, delete using (
      default::Role.Administrator in global default::currentRoles
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
