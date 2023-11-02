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
    timezone: str;
    about: str;
    required status: User::Status {
      default := User::Status.Active;
    };
    multi roles: Role;
    title: str;
    multi link pins: Mixin::Pinnable {
      on target delete allow;
    }
  }
  
  alias RootUser := (
      SELECT User
      FILTER .email = 'devops@tsco.org'
  );
}
 
module User {
  scalar type Status extending enum<Active, Disabled>;
}
