module Auth {
  type Identity {
    required user: default::User {
      constraint exclusive;
      on target delete delete source;
    }
    required passwordHash: str;
  }
  
  type Session extending Mixin::Timestamped {
    required token: str {
      constraint exclusive;
    }
    user: default::User {
      on target delete delete source;
    }
  }
  
  type EmailToken extending Mixin::Timestamped {
    required token: str {
      constraint exclusive;
    }
    
    required email: str;
    index on (.email);
  }
}
