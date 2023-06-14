module default {
  abstract type Resource {
    required createdAt: datetime {
      default := datetime_of_statement();
      readonly := true;
    };
    required modifiedAt: datetime {
      rewrite insert, update using (datetime_of_statement());
    };
  };
}
