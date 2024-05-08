module default {
  abstract type Actor {
    multi roles: Role;
  }

  type User extending Resource, Actor, Mixin::Pinnable {
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
    title: str;
    multi link pins: Mixin::Pinnable {
      on target delete allow;
    }
    multi link education: User::Education {
      on target delete allow;
      on source delete delete target;
    }
    multi link unavailabilities: User::Unavailability {
      on target delete allow;
      on source delete delete target;
    }
    multi locations: Location;

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForUser
    allow select, update read using (
      (
        exists (<Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} intersect global currentRoles)
        or .id ?= global currentActorId
        or (
          exists (<Role>{'Intern', 'Mentor'} intersect global currentRoles)
          and exists { "Stubbed .isMember for User/Unavailability" }
        )
      )
    );

    access policy CanUpdateWriteGeneratedFromAppPoliciesForUser
    allow update write;

    access policy CanInsertGeneratedFromAppPoliciesForUser
    allow insert using (
      exists (<Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect global currentRoles)
    );

    access policy CanDeleteGeneratedFromAppPoliciesForUser
    allow delete using (
      Role.Administrator in global currentRoles
    );
  }

  type SystemAgent extending Actor, Mixin::Named {
    overloaded name { constraint exclusive };
  }
}
 
module User {
  type Education extending default::Resource {
    required degree: Degree;
    required major: str;
    required institution: str;

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForEducation
    allow select, update read using (
      exists (<default::Role>{'Administrator', 'ConsultantManager', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect global default::currentRoles)
    );

    access policy CanUpdateWriteGeneratedFromAppPoliciesForEducation
    allow update write;

    access policy CanInsertGeneratedFromAppPoliciesForEducation
    allow insert using (
      exists (<default::Role>{'Administrator', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect global default::currentRoles)
    );

    access policy CanDeleteGeneratedFromAppPoliciesForEducation
    allow delete using (
      default::Role.Administrator in global default::currentRoles
    );
  }
  
  type Unavailability extending default::Resource {
    required description: str;
    required dates: range<datetime>;
    `start` := assert_exists(range_get_lower(.dates));
    `end` := assert_exists(range_get_upper(.dates));

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForUnavailability
    allow select, update read using (
      (
        exists (<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} intersect global default::currentRoles)
        or (
          exists (<default::Role>{'Intern', 'Mentor'} intersect global default::currentRoles)
          and exists { "Stubbed .isMember for User/Unavailability" }
        )
      )
    );

    access policy CanUpdateWriteGeneratedFromAppPoliciesForUnavailability
    allow update write;

    access policy CanInsertGeneratedFromAppPoliciesForUnavailability
    allow insert using (
      exists (<default::Role>{'Administrator', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect global default::currentRoles)
    );

    access policy CanDeleteGeneratedFromAppPoliciesForUnavailability
    allow delete using (
      default::Role.Administrator in global default::currentRoles
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
