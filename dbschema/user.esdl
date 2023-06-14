module default {
  type User extending Resource, Mixin::Pinnable {
    email: str {
      constraint exclusive;
    };
    required realFirstName: str;
    required realLastName: str;
    required displayFirstName: str {
      default := .realFirstName;
    };
    required displayLastName: str {
      default := .realLastName;
    };
    phone: str;
    timezone: str;
    about: str;
    required status: UserStatus {
      default := UserStatus.Active;
    };
    multi roles: Role;
    title: str;
    multi link pins: Mixin::Pinnable {
      on target delete allow;
    }
  }

  scalar type UserStatus extending enum<Active, Disabled>;

  scalar type Role extending enum<
    Administrator,
    BetaTester,
    BibleTranslationLiaison,
    Consultant,
    ConsultantManager,
    Controller,
    ExperienceOperations,
    FieldOperationsDirector,
    FieldPartner,
    FinancialAnalyst,
    Fundraising,
    Intern,
    LeadFinancialAnalyst,
    Leadership,
    Liaison,
    Marketing,
    Mentor,
    ProjectManager,
    RegionalCommunicationsCoordinator,
    RegionalDirector,
    StaffMember,
    Translator,
  >;

  alias RootUser := (
      SELECT User
      FILTER .email = 'devops@tsco.org'
  );
}
