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
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        (
          exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'StaffMember'} intersect givenRoles)
          or (
            default::Role.ConsultantManager in givenRoles
            and (
              .isMember
              or .sensitivity <= default::Sensitivity.Medium
            )
          )
          or (
            exists (<default::Role>{'Consultant', 'ConsultantManager'} intersect givenRoles)
            and .isMember
          )
          or (
            default::Role.FieldPartner in givenRoles
            and (
              .isMember
              and <str>.variant = 'partner'
            )
          )
          or (
            default::Role.Intern in givenRoles
            and .isMember
          )
          or (
            default::Role.Mentor in givenRoles
            and .isMember
          )
          or (
            exists (<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect givenRoles)
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
      )
    );

    access policy CanInsertDeleteGeneratedFromAppPoliciesForStepProgress
    allow insert, delete using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
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
