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
      on source delete delete target;
    }
    multi link unavailabilities: User::Unavailability {
      on target delete allow;
      on source delete delete target;
    }
    multi locations: Location;
  }
}
 
module User {
  type Education extending default::Resource {
    required degree: Degree;
    required major: str;
    required institution: str;
  }
  
  type Unavailability extending default::Resource {
    required description: str;
    required dates: range<datetime>;
    `start` := assert_exists(range_get_lower(.dates));
    `end` := assert_exists(range_get_upper(.dates));
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
