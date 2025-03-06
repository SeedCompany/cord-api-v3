module Mixin {
  abstract type Pinnable {
    property pinned := (
      with user := (select default::User filter .id = global default::currentActorId) 
      select __source__ in user.pins
    );
  };
};
