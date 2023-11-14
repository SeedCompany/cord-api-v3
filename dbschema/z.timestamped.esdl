module Mixin {
  abstract type Timestamped {
    required createdAt: datetime {
      default := datetime_of_statement();
      readonly := true;
    };
    required modifiedAt: datetime {
      default := datetime_of_statement(); # default here helps editor know it's not required.
      rewrite update using (datetime_of_statement());
    };
  };
}
