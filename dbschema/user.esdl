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

    access policy CanSelectGeneratedFromAppPoliciesForUser
    allow select using (
      with
        givenRoles := (<User>(global currentUserId)).roles
      select (
        (
          exists (<Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} intersect givenRoles)
          or (.isOwner ?? false)
          or (
            exists (<Role>{'Intern', 'Mentor'} intersect givenRoles)
            and exists { "Stubbed .isMember for User/Unavailability" }
          )
        )
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForUser
    allow insert using (
      with
        givenRoles := (<User>(global currentUserId)).roles
      select (
        exists (<Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect givenRoles)
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForUser
    allow delete using (
      with
        givenRoles := (<User>(global currentUserId)).roles
      select (
        Role.Administrator in givenRoles
      )
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

    access policy CanSelectGeneratedFromAppPoliciesForEducation
    allow select using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        exists (<default::Role>{'Administrator', 'ConsultantManager', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect givenRoles)
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForEducation
    allow insert using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        exists (<default::Role>{'Administrator', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect givenRoles)
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForEducation
    allow delete using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
    );
  }
  
  type Unavailability extending default::Resource {
    required description: str;
    required dates: range<cal::local_date>;

    access policy CanSelectGeneratedFromAppPoliciesForUnavailability
    allow select using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        (
          exists (<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} intersect givenRoles)
          or (
            exists (<default::Role>{'Intern', 'Mentor'} intersect givenRoles)
            and exists { "Stubbed .isMember for User/Unavailability" }
          )
        )
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForUnavailability
    allow insert using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        exists (<default::Role>{'Administrator', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect givenRoles)
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForUnavailability
    allow delete using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
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
