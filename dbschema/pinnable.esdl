module default {
  abstract type Pinnable {
    # This should work
    # property pinned := __source__ in (<User>global currentUserId).pins;
    # https://github.com/edgedb/edgedb/issues/5661
    property pinned := .id in (<User>global currentUserId).pins.id;
  };
};
