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
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        (
          exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect givenRoles)
          or (
            exists (<default::Role>{'Consultant', 'ConsultantManager'} intersect givenRoles)
            and .isMember
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
            default::Role.Translator in givenRoles
            and .isMember
          )
        )
      )
    );

    access policy CanInsertDeleteGeneratedFromAppPoliciesForCeremony
    allow insert, delete;
  }
  type DedicationCeremony extending Ceremony {}
  type CertificationCeremony extending Ceremony {}
}
