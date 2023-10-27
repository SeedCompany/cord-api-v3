module Project {
  type Member extending Resource {
    required user: default::User {
      readonly := true;
      on target delete delete source;
    };
    constraint exclusive on ((.project, .user));

    multi roles: default::Role;
  }
}
