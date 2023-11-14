module default {
  type FundingAccount extending Resource, Mixin::Named {
    overloaded name {
      constraint exclusive;
    }

    required accountNumber: int16 {
      constraint min_value(0);
      constraint max_value(9);
    }
  }
}
