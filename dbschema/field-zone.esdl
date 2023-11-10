module default {
  type FieldZone extending Resource, Mixin::Named {
    overloaded name {
      constraint exclusive;
    }
    
    required director: User;
  }
}
