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
        givenRoles := (<User>(global currentUserId)).roles
      select (
        (
          exists (<Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'Leadership', 'RegionalDirector', 'FieldOperationsDirector'} intersect givenRoles)
          or (
            exists (<Role>{'Consultant', 'ConsultantManager', 'FieldPartner'} intersect givenRoles)
            and .isMember
          )
          or (
            exists (<Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect givenRoles)
            and (
              .isMember
              or .sensitivity <= Sensitivity.Medium
            )
          )
          or (
            Role.StaffMember in givenRoles
            and .sensitivity <= Sensitivity.Low
          )
        )
      )
    );

    access policy CanInsertDeleteGeneratedFromAppPoliciesForPartnership
    allow insert, delete using (
      with
        givenRoles := (<User>(global currentUserId)).roles
      select (
        (
          exists (<Role>{'Administrator', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller'} intersect givenRoles)
          or (
            exists (<Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} intersect givenRoles)
            and .isMember
          )
          or (
            exists (<Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect givenRoles)
            and (
              .isMember
              or .sensitivity <= Sensitivity.Medium
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
