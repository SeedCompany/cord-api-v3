module Mixin {
  abstract type Owned {
    link owner: default::User {
      default := <default::User>(global default::currentUserId);
    };
    property isOwner := .owner = <default::User>(global default::currentUserId);
  }
}
