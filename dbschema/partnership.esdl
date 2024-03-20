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

    access policy CanSelectGeneratedFromAppPoliciesForPartnership
    allow select using (
      (
        exists (<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'Leadership', 'RegionalDirector', 'FieldOperationsDirector'} intersect (<default::User>(global default::currentUserId)).roles)
        or (
          exists (<default::Role>{'Consultant', 'ConsultantManager'} intersect (<default::User>(global default::currentUserId)).roles)
          and .isMember
        )
        or (
          default::Role.FieldPartner in (<default::User>(global default::currentUserId)).roles
          and .isMember
        )
        or (
          exists (<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect (<default::User>(global default::currentUserId)).roles)
          and (
            .isMember
            or .sensitivity <= default::Sensitivity.Medium
          )
        )
        or (
          default::Role.StaffMember in (<default::User>(global default::currentUserId)).roles
          and .sensitivity <= default::Sensitivity.Low
        )
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForPartnership
    allow insert using (
      (
        exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller'} intersect (<default::User>(global default::currentUserId)).roles)
        or (
          exists (<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} intersect (<default::User>(global default::currentUserId)).roles)
          and .isMember
        )
        or (
          exists (<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect (<default::User>(global default::currentUserId)).roles)
          and (
            .isMember
            or .sensitivity <= default::Sensitivity.Medium
          )
        )
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForPartnership
    allow delete using (
      (
        exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller'} intersect (<default::User>(global default::currentUserId)).roles)
        or (
          exists (<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} intersect (<default::User>(global default::currentUserId)).roles)
          and .isMember
        )
        or (
          exists (<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect (<default::User>(global default::currentUserId)).roles)
          and (
            .isMember
            or .sensitivity <= default::Sensitivity.Medium
          )
        )
      )
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
