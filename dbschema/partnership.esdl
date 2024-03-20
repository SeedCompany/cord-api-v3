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
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        (
          exists (<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'Leadership', 'RegionalDirector', 'FieldOperationsDirector'} intersect givenRoles)
          or (
            exists (<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner'} intersect givenRoles)
            and .isMember
          )
          or (
            exists (<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect givenRoles)
            and (
              .isMember
              or .sensitivity <= default::Sensitivity.Medium
            )
          )
          or (
            default::Role.StaffMember in givenRoles
            and .sensitivity <= default::Sensitivity.Low
          )
        )
      )
    );

    access policy CanInsertDeleteGeneratedFromAppPoliciesForPartnership
    allow insert, delete using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        (
          exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller'} intersect givenRoles)
          or (
            exists (<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} intersect givenRoles)
            and .isMember
          )
          or (
            exists (<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect givenRoles)
            and (
              .isMember
              or .sensitivity <= default::Sensitivity.Medium
            )
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
