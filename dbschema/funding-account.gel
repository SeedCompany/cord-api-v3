module default {
  type FundingAccount extending Resource, Mixin::Named {
    overloaded name {
      constraint exclusive;
    }
    
    required accountNumber: int16 {
      constraint expression on (__subject__ >= 0 and __subject__ <= 9);
    }
  }
}
