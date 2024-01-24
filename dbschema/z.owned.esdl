module Mixin {
  abstract type Owned {
    link owner: default::User {
      default := default::currentUser;
    };
    property isOwner := .owner = <default::User>(global default::currentUserId);
  }
}
