module Mixin {
  abstract type UserStamped {
    required createdBy: default::User {
      readonly := true;
      default := default::currentUser;
    };
    required modifiedBy: default::User {
      default := default::currentUser;
      rewrite update using (default::currentUser);
    };
  }

  abstract type Timestamped {
    required createdAt: datetime {
      default := datetime_of_statement();
      readonly := true;
    };
    required modifiedAt: datetime {
      default := datetime_of_statement(); # default here helps editor know it's not required.
      rewrite update using (datetime_of_statement());
    };
  }
}
