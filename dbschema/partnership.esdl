module default {
  type Partnership extending Project::Child {
    required partner: Partner;
    constraint exclusive on ((.project, .partner));
    organization := .partner.organization;
    
    required primary: bool {
      default := false;
    };
    multi types: Partner::Type;
    financialReportingType: Partnership::FinancialReportingType;
    
    mouStart := .mouStartOverride ?? .project.mouStart;
    mouEnd := .mouEndOverride ?? .project.mouEnd;
    mouStartOverride: cal::local_date;
    mouEndOverride: cal::local_date;
    
    agreement: File;
    required agreementStatus: Partnership::AgreementStatus {
      default := Partnership::AgreementStatus.NotAttached;
    };
    mou: File;
    required mouStatus: Partnership::AgreementStatus {
      default := Partnership::AgreementStatus.NotAttached;
    };

    access policy CanReadGeneratedFromAppPoliciesForPartnership
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'ConsultantManager', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'FinancialAnalyst', 'Fundraising', 'LeadFinancialAnalyst', 'Leadership', 'Marketing', 'RegionalDirector'} intersect default::currentUser.roles)
        or (exists (<default::Role>{'Consultant', 'FieldPartner'} intersect default::currentUser.roles) and .isMember)
        or (default::Role.ProjectManager in default::currentUser.roles and (.isMember or .sensitivity <= default::Sensitivity.Medium))
        or (default::Role.StaffMember in default::currentUser.roles and .sensitivity <= default::Sensitivity.Low)
    );
    access policy CanCreateGeneratedFromAppPoliciesForPartnership
    allow insert using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Controller', 'FieldOperationsDirector', 'LeadFinancialAnalyst'} intersect default::currentUser.roles)
        or (default::Role.FinancialAnalyst in default::currentUser.roles and .isMember)
        or (exists (<default::Role>{'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles) and (.isMember or .sensitivity <= default::Sensitivity.Medium))
    );
    access policy CanDeleteGeneratedFromAppPoliciesForPartnership
    allow delete using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Controller', 'FieldOperationsDirector', 'LeadFinancialAnalyst'} intersect default::currentUser.roles)
        or (default::Role.FinancialAnalyst in default::currentUser.roles and .isMember)
        or (exists (<default::Role>{'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles) and (.isMember or .sensitivity <= default::Sensitivity.Medium))
    );
  }
}
  
module Partnership {
  scalar type AgreementStatus extending enum<
    NotAttached,
    AwaitingSignature,
    Signed
  >;
  
  scalar type FinancialReportingType extending enum<
    Funded,
    FieldEngaged,
    Hybrid
  >;
}
