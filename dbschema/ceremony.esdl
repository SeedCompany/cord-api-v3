module Engagement {
  abstract type Ceremony extending Child {
    required planned: bool {
      default := false;
    };
    estimatedDate: cal::local_date;
    actualDate: cal::local_date;
    
    constraint exclusive on (.engagement);
    trigger prohibitDelete after delete for each do (
      assert(
        not exists (__old__.engagement),
        message := "Cannot delete ceremony while engagement still exists."
      )
    );

    access policy CanSelectGeneratedFromAppPoliciesForCeremony
    allow select using (
      (
        exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect (<default::User>(global default::currentUserId)).roles)
        or (
          exists (<default::Role>{'Consultant', 'ConsultantManager'} intersect (<default::User>(global default::currentUserId)).roles)
          and .isMember
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
          default::Role.Translator in (<default::User>(global default::currentUserId)).roles
          and .isMember
        )
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForCeremony
    allow insert using (
      true
    );

    access policy CanDeleteGeneratedFromAppPoliciesForCeremony
    allow delete using (
      true
    );
  }
  type DedicationCeremony extending Ceremony {}
  type CertificationCeremony extending Ceremony {}
}
