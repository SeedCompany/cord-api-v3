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

    access policy CanReadGeneratedFromAppPoliciesForCeremony
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'FinancialAnalyst', 'Fundraising', 'LeadFinancialAnalyst', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect default::currentUser.roles)
        or (exists (<default::Role>{'Consultant', 'ConsultantManager', 'Intern', 'Mentor', 'Translator'} intersect default::currentUser.roles) and .isMember)
    );
  }
  type DedicationCeremony extending Ceremony {}
  type CertificationCeremony extending Ceremony {}
}
