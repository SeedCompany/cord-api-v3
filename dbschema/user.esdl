module default {
  type User extending Resource, Mixin::Pinnable, Mixin::Owned {
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
    required timezone: str {
      default := 'America/Chicago';
    };
    about: str;
    required status: User::Status {
      default := User::Status.Active;
    };
    multi roles: Role;
    title: str;
    multi link pins: Mixin::Pinnable {
      on target delete allow;
    }
    multi link education: User::Education {
      on target delete allow;
    }
    multi link unavailabilities: User::Unavailability {
      on target delete allow;
    }

    access policy CanReadGeneratedFromAppPoliciesForUser
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'FinancialAnalyst', 'Fundraising', 'LeadFinancialAnalyst', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect default::currentUser.roles)
        or (exists (<default::Role>{'BetaTester', 'BibleTranslationLiaison', 'Liaison', 'RegionalCommunicationsCoordinator', 'Translator'} intersect default::currentUser.roles) and (.isOwner ?? false))
        or (default::Role.Intern in default::currentUser.roles and (exists { "Stubbed .isMember for User/Unavailability" } or (.isOwner ?? false)))
        or (default::Role.Mentor in default::currentUser.roles and (exists { "Stubbed .isMember for User/Unavailability" } or (.isOwner ?? false)))
    );
    access policy CanCreateGeneratedFromAppPoliciesForUser
    allow insert using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'Controller', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles)
    );
    access policy CanDeleteGeneratedFromAppPoliciesForUser
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
  }
  
  alias RootUser := (
      SELECT User
      FILTER .email = 'devops@tsco.org'
  );
}
 
module User {
  type Education extending default::Resource {
    required degree: Degree;
    required major: str;
    required institution: str;

    access policy CanReadGeneratedFromAppPoliciesForEducation
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'ConsultantManager', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'FinancialAnalyst', 'Fundraising', 'LeadFinancialAnalyst', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect default::currentUser.roles)
    );
    access policy CanCreateGeneratedFromAppPoliciesForEducation
    allow insert using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles)
    );
    access policy CanDeleteGeneratedFromAppPoliciesForEducation
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
  }
  
  type Unavailability extending default::Resource {
    required description: str;
    required dates: range<cal::local_date>;

    access policy CanReadGeneratedFromAppPoliciesForUnavailability
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'FinancialAnalyst', 'Fundraising', 'LeadFinancialAnalyst', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect default::currentUser.roles)
        or (exists (<default::Role>{'Intern', 'Mentor'} intersect default::currentUser.roles) and exists { "Stubbed .isMember for User/Unavailability" })
    );
    access policy CanCreateGeneratedFromAppPoliciesForUnavailability
    allow insert using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles)
    );
    access policy CanDeleteGeneratedFromAppPoliciesForUnavailability
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
  }
  
  scalar type Status extending enum<Active, Disabled>;
  
  scalar type Degree extending enum<
    Primary,
    Secondary,
    Associates,
    Bachelors,
    Masters,
    Doctorate
  >;
}
