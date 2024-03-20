module ProgressReport::ProductProgress {
  type Step extending Mixin::Timestamped, Project::ContextAware {
    required report: default::ProgressReport;
    required product: default::Product;
    required variant: Variant;
    required step: Product::Step;
    constraint exclusive on ((.report, .product, .variant, .step));

    completed: float32;

    access policy CanReadGeneratedFromAppPoliciesForStepProgress
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'FinancialAnalyst', 'Fundraising', 'LeadFinancialAnalyst', 'Leadership', 'Marketing', 'StaffMember'} intersect default::currentUser.roles)
        or (exists (<default::Role>{'Consultant', 'Intern', 'Mentor'} intersect default::currentUser.roles) and .isMember)
        or (default::Role.ConsultantManager in default::currentUser.roles and (.isMember or .sensitivity <= default::Sensitivity.Medium))
        or (default::Role.FieldPartner in default::currentUser.roles and (.isMember and <str>.variant = 'partner'))
        or (exists (<default::Role>{'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles) and ((.isMember and <str>.variant = 'official') or (.isMember and <str>.variant = 'partner')))
    );
    access policy CanCreateGeneratedFromAppPoliciesForStepProgress
    allow insert using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
    access policy CanDeleteGeneratedFromAppPoliciesForStepProgress
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
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
