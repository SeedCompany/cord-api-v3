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
