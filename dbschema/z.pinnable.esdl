module Mixin {
  abstract type Pinnable {
    property pinned := __source__ in (<default::User>global default::currentUserId).pins;
  };
};
