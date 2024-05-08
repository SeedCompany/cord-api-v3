module Engagement {
  abstract type Ceremony extending Child {
    required planned: bool {
      default := false;
    };
    estimatedDate: cal::local_date;
    actualDate: cal::local_date;
    
    constraint exclusive on (.engagement);

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForCeremony
    allow select, update read using (
      (
        exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect global default::currentRoles)
        or (
          exists (<default::Role>{'Consultant', 'ConsultantManager', 'Intern', 'Mentor', 'Translator'} intersect global default::currentRoles)
          and .isMember
        )
      )
    );

    access policy CanUpdateWriteInsertDeleteGeneratedFromAppPoliciesForCeremony
    allow update write, insert, delete;
  }
  type DedicationCeremony extending Ceremony {}
  type CertificationCeremony extending Ceremony {}
}
