module default {

  type Partnership extending Project::Child {
    required partner: Partner;
    organization := .partner.organization;
    constraint exclusive on ((.project, .partner));
    agreement: File;
    required agreementStatus: Partnership::AgreementStatus {
      default := Partnership::AgreementStatus.NotAttached;
    };
    mou: File; 
    mouStatus: Partnership::AgreementStatus;
    mouStart := .mouStartOverride ?? .project.mouStart;
    mouEnd := .mouEndOverride ?? .project.mouEnd;
    mouStartOverride: cal::local_date;
    mouEndOverride: cal::local_date;
    multi types: Partner::Type;
    financialReportingType: Partnership::FinancialReportingType;
    required primary: bool {
      default := false;
    }

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
